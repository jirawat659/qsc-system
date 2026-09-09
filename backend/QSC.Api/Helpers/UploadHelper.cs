using System;
using System.IO;
using Microsoft.AspNetCore.Hosting;

namespace QSC.Api.Helpers
{
    public static class UploadHelper
    {
        public static string GetUploadsRootPath(IWebHostEnvironment env)
        {
            try
            {
                var frontendUploadsPath = Path.GetFullPath(Path.Combine(env.ContentRootPath, "..", "..", "frontend", "public", "uploads"));
                if (Directory.Exists(frontendUploadsPath) || Directory.Exists(Path.GetFullPath(Path.Combine(env.ContentRootPath, "..", "..", "frontend", "public"))))
                {
                    Directory.CreateDirectory(frontendUploadsPath);
                    return frontendUploadsPath;
                }
            }
            catch {}

            var webRoot = env.WebRootPath ?? Path.Combine(env.ContentRootPath, "wwwroot");
            var defaultUploadsPath = Path.Combine(webRoot, "uploads");
            Directory.CreateDirectory(defaultUploadsPath);
            return defaultUploadsPath;
        }
    }
}
