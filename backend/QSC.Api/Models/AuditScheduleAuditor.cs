namespace QSC.Api.Models
{
    public class AuditScheduleAuditor
    {
        public int Id { get; set; }
        public int AuditScheduleId { get; set; }
        public AuditSchedule? AuditSchedule { get; set; }
        public int AuditorId { get; set; }
        public User? Auditor { get; set; }
        public bool IsLead { get; set; } = true;
    }
}

