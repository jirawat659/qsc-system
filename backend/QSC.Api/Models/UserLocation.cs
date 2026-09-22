namespace QSC.Api.Models
{
    public class UserLocation
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public User? User { get; set; }
        public int LocationId { get; set; }
        public Location? Location { get; set; }
    }
}