import * as signalR from "@microsoft/signalr";
import { SERVER_BASE_URL } from "../config/api";
import authStorage from "../config/storage";

class SignalRService {
  constructor() {
    this.connection = null;
    this.connectedToken = null;
    this.joinedRooms = new Set();
    this.messageHandlers = new Set();
    this.statusHandlers = new Set();
    this.auditHandlers = new Set();
    this.isConnecting = false;
  }

  /**
   * Initializes or returns active SignalR connection
   */
  async getConnection() {
    const currentToken = authStorage.getToken() || "";

    // 🛡️ If user switched accounts or token changed, disconnect old connection immediately
    if (this.connection && this.connectedToken !== currentToken) {
      try {
        await this.connection.stop();
      } catch (e) {}
      this.connection = null;
      this.connectedToken = null;
      this.joinedRooms.clear();
    }

    if (this.connection && this.connection.state === signalR.HubConnectionState.Connected) {
      return this.connection;
    }

    if (this.isConnecting) {
      let attempts = 0;
      while (this.isConnecting && attempts < 20) {
        await new Promise((res) => setTimeout(res, 100));
        attempts++;
      }
      if (this.connection && this.connection.state === signalR.HubConnectionState.Connected) {
        return this.connection;
      }
    }

    this.isConnecting = true;

    try {
      const hubUrl = `${SERVER_BASE_URL}/hubs/cap-chat`;

      const builder = new signalR.HubConnectionBuilder()
        .withUrl(hubUrl, {
          accessTokenFactory: () => authStorage.getToken() || "",
          skipNegotiation: false,
          transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.LongPolling,
        })
        .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
        .configureLogging(signalR.LogLevel.Warning);

      this.connection = builder.build();
      this.connectedToken = currentToken;

      // Register server event listeners
      this.connection.on("ReceiveCapMessage", (comment) => {
        this.messageHandlers.forEach((handler) => {
          try {
            handler(comment);
          } catch (e) {}
        });
      });

      this.connection.on("CapStatusUpdated", (statusUpdate) => {
        this.statusHandlers.forEach((handler) => {
          try {
            handler(statusUpdate);
          } catch (e) {}
        });
      });

      this.connection.on("AuditCreated", (auditPayload) => {
        this.auditHandlers.forEach((handler) => {
          try {
            handler(auditPayload);
          } catch (e) {}
        });
      });

      // On Reconnected, re-join all active rooms
      this.connection.onreconnected(async () => {
        for (const roomId of this.joinedRooms) {
          try {
            await this.connection.invoke("JoinCapRoom", roomId);
          } catch (e) {}
        }
      });

      await this.connection.start();
      this.isConnecting = false;
      return this.connection;
    } catch (err) {
      this.isConnecting = false;
      return null;
    }
  }

  /**
   * Joins specific defect ticket room
   * @param {number} capTaskId
   */
  async joinCapRoom(capTaskId) {
    if (!capTaskId) return;
    const id = parseInt(capTaskId, 10);
    this.joinedRooms.add(id);
    const conn = await this.getConnection();
    if (conn && conn.state === signalR.HubConnectionState.Connected) {
      try {
        await conn.invoke("JoinCapRoom", id);
      } catch (e) {}
    }
  }

  /**
   * Leaves specific defect ticket room
   * @param {number} capTaskId
   */
  async leaveCapRoom(capTaskId) {
    if (!capTaskId) return;
    const id = parseInt(capTaskId, 10);
    this.joinedRooms.delete(id);
    if (this.connection && this.connection.state === signalR.HubConnectionState.Connected) {
      try {
        await this.connection.invoke("LeaveCapRoom", id);
      } catch (e) {}
    }
  }

  /**
   * Sends real-time message through SignalR Hub
   * @param {number} capTaskId
   * @param {string} message
   * @param {string|null} imageUrl
   */
  async sendCapMessage(capTaskId, message, imageUrl = null) {
    const id = parseInt(capTaskId, 10);
    const conn = await this.getConnection();
    if (conn && conn.state === signalR.HubConnectionState.Connected) {
      return await conn.invoke("SendCapMessage", id, message || "", imageUrl);
    }
    throw new Error("SignalR connection is not active");
  }

  /**
   * Subscribes to ReceiveCapMessage event (Returns unsubscribe function)
   * @param {Function} handler
   * @returns {Function} unsubscribe
   */
  onReceiveCapMessage(handler) {
    this.messageHandlers.add(handler);
    return () => {
      this.messageHandlers.delete(handler);
    };
  }

  /**
   * Subscribes to CapStatusUpdated event (Returns unsubscribe function)
   * @param {Function} handler
   * @returns {Function} unsubscribe
   */
  onCapStatusUpdated(handler) {
    this.statusHandlers.add(handler);
    return () => {
      this.statusHandlers.delete(handler);
    };
  }

  /**
   * Subscribes to AuditCreated event (Returns unsubscribe function)
   * @param {Function} handler
   * @returns {Function} unsubscribe
   */
  onAuditCreated(handler) {
    this.auditHandlers.add(handler);
    return () => {
      this.auditHandlers.delete(handler);
    };
  }

  /**
   * Disconnects the SignalR connection
   */
  async disconnect() {
    if (this.connection) {
      try {
        await this.connection.stop();
      } catch (e) {}
      this.connection = null;
      this.connectedToken = null;
      this.joinedRooms.clear();
    }
  }
}

export const signalRService = new SignalRService();
export default signalRService;
