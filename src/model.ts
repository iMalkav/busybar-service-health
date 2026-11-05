import {
  record,
  str,
  cycle,
  requiredNumber,
  splitList,
  url,
  App,
  type Settings,
  type View,
  type HttpSpec,
} from "./lib.ts";

export class AppModel extends App {
  services: {
    name: string;
    url: string;
    status: number;
    elapsed: number;
    error: string;
  }[] = [];
  selected = 0;
  checking = 0;
  lastCheck = 0;
  constructor(s: Settings, saved: Settings, now: number) {
    super(s, saved, now);
    for (const entry of splitList(str(s, "services"), 4)) {
      const index = entry.indexOf("=");
      if (index > 0) {
        try {
          this.services.push({
            name: entry.slice(0, index),
            url: url(entry.slice(index + 1)),
            status: 0,
            elapsed: 0,
            error: "",
          });
        } catch {
          this.error = "Invalid service URL";
        }
      }
    }
  }
  request(_now: number): HttpSpec | undefined {
    if (!this.services.length) {
      this.error = "Set Name=URL entries in Setup";
      return undefined;
    }
    this.checking = this.lastCheck++ % this.services.length;
    return { url: this.services[this.checking].url, response: "status" };
  }
  receive(value: unknown, now: number): void {
    const v = record(value);
    const status = requiredNumber(v.status);
    if (status < 100 || status > 599) throw new Error("Invalid HTTP status");
    const s = this.services[this.checking];
    s.status = status;
    s.elapsed = requiredNumber(v.elapsed_ms);
    s.error = "";
    this.lastReceived = now;
    this.error = "";
  }
  fail(message: string): void {
    super.fail(message);
    const service = this.services[this.checking];
    if (service) service.error = message;
  }
  key(key: string, delta: number, _now: number): boolean {
    if (key === "wheel")
      this.selected = cycle(this.selected, delta, this.services.length);
    return false;
  }
  view(_now: number): View {
    if (!this.services.length)
      return {
        title: "Service Health",
        value: "SET SERVICES",
        rows: ["Use Name=URL in Setup"],
        hint: this.error,
      };
    const s = this.services[this.selected];
    const up = s.status >= 200 && s.status < 400 && !s.error;
    return {
      title: s.name,
      value: s.error
        ? "UNREACHABLE"
        : s.status
          ? "HTTP " + s.status
          : "WAITING",
      rows: [
        s.status ? Math.round(s.elapsed) + " ms" : "Not checked",
        s.error || s.url,
      ],
      color: up ? "#66EE99FF" : "#FF9977FF",
      hint: "Wheel service / OK check",
    };
  }
}
