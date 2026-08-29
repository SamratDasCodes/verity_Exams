import os from "os";

export function getServerNetworkIp(): string {
  try {
    const interfaces = os.networkInterfaces();

    // Priority 1: Hotspot or Wi-Fi local networks (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
    for (const [name, addrs] of Object.entries(interfaces)) {
      if (!addrs) continue;
      for (const net of addrs) {
        if (net.family === "IPv4" && !net.internal) {
          // Exclude virtual VPNs like Tailscale (100.x.x.x)
          if (!net.address.startsWith("100.")) {
            return net.address;
          }
        }
      }
    }

    // Priority 2: Any non-internal IPv4
    for (const [name, addrs] of Object.entries(interfaces)) {
      if (!addrs) continue;
      for (const net of addrs) {
        if (net.family === "IPv4" && !net.internal) {
          return net.address;
        }
      }
    }
  } catch (err) {
    console.error("Error determining network IP:", err);
  }

  return "localhost";
}
