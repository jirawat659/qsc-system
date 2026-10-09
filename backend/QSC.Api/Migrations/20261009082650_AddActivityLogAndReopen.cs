using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace QSC.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddActivityLogAndReopen : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('AuditRecords') AND name = 'DocumentNo')
                BEGIN
                    ALTER TABLE [AuditRecords] ADD [DocumentNo] nvarchar(50) NULL;
                END
            ");

            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('AuditRecords') AND name = 'ReopenReason')
                BEGIN
                    ALTER TABLE [AuditRecords] ADD [ReopenReason] nvarchar(max) NULL;
                END
            ");

            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('AuditRecords') AND name = 'ReopenedFromRecordId')
                BEGIN
                    ALTER TABLE [AuditRecords] ADD [ReopenedFromRecordId] int NULL;
                END
            ");

            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('AuditRecords') AND name = 'Status')
                BEGIN
                    ALTER TABLE [AuditRecords] ADD [Status] nvarchar(20) NOT NULL DEFAULT N'SUBMITTED';
                END
            ");

            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('AuditDrafts') AND name = 'DocumentNo')
                BEGIN
                    ALTER TABLE [AuditDrafts] ADD [DocumentNo] nvarchar(50) NULL;
                END
            ");

            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('AuditDrafts') AND name = 'ReopenedFromRecordId')
                BEGIN
                    ALTER TABLE [AuditDrafts] ADD [ReopenedFromRecordId] int NULL;
                END
            ");

            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ActivityLogs')
                BEGIN
                    CREATE TABLE [ActivityLogs] (
                        [Id] int NOT NULL IDENTITY,
                        [OccurredAt] datetime2 NOT NULL,
                        [UserId] int NOT NULL,
                        [Action] nvarchar(50) NOT NULL,
                        [EntityType] nvarchar(50) NULL,
                        [EntityId] int NULL,
                        [LocationId] int NULL,
                        [CreatedAt] datetime2 NOT NULL DEFAULT (GETUTCDATE()),
                        [CreatedBy] int NULL,
                        [UpdatedAt] datetime2 NULL,
                        [UpdatedBy] int NULL,
                        [VersionNumber] rowversion NULL,
                        CONSTRAINT [PK_ActivityLogs] PRIMARY KEY ([Id])
                    );
                END
            ");

            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_AuditRecords_DocumentNo' AND object_id = OBJECT_ID('AuditRecords'))
                BEGIN
                    CREATE INDEX [IX_AuditRecords_DocumentNo] ON [AuditRecords] ([DocumentNo]);
                END
            ");

            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_AuditRecords_ReopenedFromRecordId' AND object_id = OBJECT_ID('AuditRecords'))
                BEGIN
                    CREATE INDEX [IX_AuditRecords_ReopenedFromRecordId] ON [AuditRecords] ([ReopenedFromRecordId]);
                END
            ");

            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_AuditRecords_Status' AND object_id = OBJECT_ID('AuditRecords'))
                BEGIN
                    CREATE INDEX [IX_AuditRecords_Status] ON [AuditRecords] ([Status]);
                END
            ");

            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_AuditDrafts_DocumentNo' AND object_id = OBJECT_ID('AuditDrafts'))
                BEGIN
                    CREATE INDEX [IX_AuditDrafts_DocumentNo] ON [AuditDrafts] ([DocumentNo]);
                END
            ");

            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_AuditDrafts_ReopenedFromRecordId' AND object_id = OBJECT_ID('AuditDrafts'))
                BEGIN
                    CREATE INDEX [IX_AuditDrafts_ReopenedFromRecordId] ON [AuditDrafts] ([ReopenedFromRecordId]);
                END
            ");

            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ActivityLogs_EntityType_EntityId' AND object_id = OBJECT_ID('ActivityLogs'))
                BEGIN
                    CREATE INDEX [IX_ActivityLogs_EntityType_EntityId] ON [ActivityLogs] ([EntityType], [EntityId]);
                END
            ");

            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ActivityLogs_OccurredAt' AND object_id = OBJECT_ID('ActivityLogs'))
                BEGIN
                    CREATE INDEX [IX_ActivityLogs_OccurredAt] ON [ActivityLogs] ([OccurredAt]);
                END
            ");

            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ActivityLogs_UserId_OccurredAt' AND object_id = OBJECT_ID('ActivityLogs'))
                BEGIN
                    CREATE INDEX [IX_ActivityLogs_UserId_OccurredAt] ON [ActivityLogs] ([UserId], [OccurredAt]);
                END
            ");

            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_AuditDrafts_AuditRecords_ReopenedFromRecordId')
                BEGIN
                    ALTER TABLE [AuditDrafts] ADD CONSTRAINT [FK_AuditDrafts_AuditRecords_ReopenedFromRecordId] 
                    FOREIGN KEY ([ReopenedFromRecordId]) REFERENCES [AuditRecords] ([Id]) ON DELETE NO ACTION;
                END
            ");

            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_AuditRecords_AuditRecords_ReopenedFromRecordId')
                BEGIN
                    ALTER TABLE [AuditRecords] ADD CONSTRAINT [FK_AuditRecords_AuditRecords_ReopenedFromRecordId] 
                    FOREIGN KEY ([ReopenedFromRecordId]) REFERENCES [AuditRecords] ([Id]) ON DELETE NO ACTION;
                END
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_AuditDrafts_AuditRecords_ReopenedFromRecordId",
                table: "AuditDrafts");

            migrationBuilder.DropForeignKey(
                name: "FK_AuditRecords_AuditRecords_ReopenedFromRecordId",
                table: "AuditRecords");

            migrationBuilder.DropTable(
                name: "ActivityLogs");

            migrationBuilder.DropIndex(
                name: "IX_AuditRecords_DocumentNo",
                table: "AuditRecords");

            migrationBuilder.DropIndex(
                name: "IX_AuditRecords_ReopenedFromRecordId",
                table: "AuditRecords");

            migrationBuilder.DropIndex(
                name: "IX_AuditRecords_Status",
                table: "AuditRecords");

            migrationBuilder.DropIndex(
                name: "IX_AuditDrafts_DocumentNo",
                table: "AuditDrafts");

            migrationBuilder.DropIndex(
                name: "IX_AuditDrafts_ReopenedFromRecordId",
                table: "AuditDrafts");

            migrationBuilder.DropColumn(
                name: "DocumentNo",
                table: "AuditRecords");

            migrationBuilder.DropColumn(
                name: "ReopenReason",
                table: "AuditRecords");

            migrationBuilder.DropColumn(
                name: "ReopenedFromRecordId",
                table: "AuditRecords");

            migrationBuilder.DropColumn(
                name: "Status",
                table: "AuditRecords");

            migrationBuilder.DropColumn(
                name: "DocumentNo",
                table: "AuditDrafts");

            migrationBuilder.DropColumn(
                name: "ReopenedFromRecordId",
                table: "AuditDrafts");
        }
    }
}
