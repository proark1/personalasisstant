import { CalendarEvent } from "@/types/flux";

interface ICSEvent {
  uid: string;
  summary: string;
  description?: string;
  dtstart: Date;
  dtend: Date;
  location?: string;
  attendees?: string[];
}

export function parseICS(content: string): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const lines = content.split(/\r?\n/);

  let currentEvent: Partial<ICSEvent> | null = null;
  let currentKey = "";
  let currentValue = "";

  const parseDate = (dateStr: string): Date => {
    // Handle different ICS date formats
    // YYYYMMDDTHHMMSS or YYYYMMDDTHHMMSSZ or YYYYMMDD
    const cleaned = dateStr.replace(/[^\dT]/g, "");

    if (cleaned.length === 8) {
      // YYYYMMDD - all day event
      const year = parseInt(cleaned.slice(0, 4));
      const month = parseInt(cleaned.slice(4, 6)) - 1;
      const day = parseInt(cleaned.slice(6, 8));
      return new Date(year, month, day);
    } else if (cleaned.length >= 15) {
      // YYYYMMDDTHHMMSS
      const year = parseInt(cleaned.slice(0, 4));
      const month = parseInt(cleaned.slice(4, 6)) - 1;
      const day = parseInt(cleaned.slice(6, 8));
      const hour = parseInt(cleaned.slice(9, 11));
      const minute = parseInt(cleaned.slice(11, 13));
      const second = parseInt(cleaned.slice(13, 15));

      if (dateStr.endsWith("Z")) {
        return new Date(Date.UTC(year, month, day, hour, minute, second));
      }
      return new Date(year, month, day, hour, minute, second);
    }

    return new Date(dateStr);
  };

  const processLine = (key: string, value: string) => {
    if (!currentEvent) return;

    // Handle property parameters (e.g., DTSTART;VALUE=DATE:20231225)
    const [propName] = key.split(";");

    switch (propName.toUpperCase()) {
      case "UID":
        currentEvent.uid = value;
        break;
      case "SUMMARY":
        currentEvent.summary = value;
        break;
      case "DESCRIPTION":
        currentEvent.description = value.replace(/\\n/g, "\n").replace(/\\,/g, ",");
        break;
      case "DTSTART":
        currentEvent.dtstart = parseDate(value);
        break;
      case "DTEND":
        currentEvent.dtend = parseDate(value);
        break;
      case "LOCATION":
        currentEvent.location = value;
        break;
      case "ATTENDEE": {
        if (!currentEvent.attendees) currentEvent.attendees = [];
        // Extract name from CN= or use email
        const cnMatch = value.match(/CN=([^;:]+)/i);
        const mailtoMatch = value.match(/mailto:([^;]+)/i);
        currentEvent.attendees.push(cnMatch?.[1] || mailtoMatch?.[1] || value);
        break;
      }
    }
  };

  for (const line of lines) {
    // Handle line folding (lines starting with space or tab are continuations)
    if (line.startsWith(" ") || line.startsWith("\t")) {
      currentValue += line.slice(1);
      continue;
    }

    // Process the previous complete property
    if (currentKey && currentValue) {
      processLine(currentKey, currentValue);
    }

    // Parse new line
    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) continue;

    currentKey = line.slice(0, colonIndex);
    currentValue = line.slice(colonIndex + 1);

    if (line === "BEGIN:VEVENT") {
      currentEvent = {};
    } else if (line === "END:VEVENT" && currentEvent) {
      // Process any remaining property
      if (currentKey && currentValue) {
        processLine(currentKey, currentValue);
      }

      // Validate and add event
      if (currentEvent.summary && currentEvent.dtstart) {
        const endTime =
          currentEvent.dtend || new Date(currentEvent.dtstart.getTime() + 60 * 60 * 1000);

        events.push({
          id: currentEvent.uid || Math.random().toString(36).substring(2, 15),
          title: currentEvent.summary,
          description: currentEvent.description,
          startTime: currentEvent.dtstart,
          endTime,
          location: currentEvent.location,
          attendees: currentEvent.attendees,
        });
      }
      currentEvent = null;
      currentKey = "";
      currentValue = "";
    }
  }

  // Sort by start time
  return events.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
}

export function validateICSFile(file: File): boolean {
  return file.name.endsWith(".ics") || file.type === "text/calendar";
}
