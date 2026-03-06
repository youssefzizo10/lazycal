/**
 * Google Calendar API Integration Module
 * 
 * This module handles authentication and API calls to Google Calendar.
 * To use real Google Calendar data, you'll need to:
 * 
 * 1. Create a project in Google Cloud Console
 * 2. Enable the Google Calendar API
 * 3. Create OAuth 2.0 credentials (Desktop application type)
 * 4. Download the credentials JSON file
 * 5. Place it at ~/.config/lazycal/credentials.json
 * 
 * On first run, the app will open a browser for OAuth authentication
 * and save the token to ~/.config/lazycal/token.json
 */

import { google, calendar_v3 } from "googleapis"
import { OAuth2Client } from "google-auth-library"
import * as fs from "fs/promises"
import * as path from "path"
import { homedir } from "os"
import { startOfWeek, endOfWeek } from "date-fns"
import * as http from "http"
import * as url from "url"

const SCOPES = ["https://www.googleapis.com/auth/calendar"]
const CONFIG_DIR = path.join(homedir(), ".config", "lazycal")
const CREDENTIALS_PATH = path.join(CONFIG_DIR, "credentials.json")
const TOKEN_PATH = path.join(CONFIG_DIR, "token.json")
const REDIRECT_PORT = 8080

export interface CalendarEvent {
  id: string
  title: string
  date: Date
  start: Date
  end: Date | null
  isAllDay: boolean
  time?: string
  description?: string
  location?: string
  calendarId?: string
  calendarName?: string
}

export interface CreateCalendarEventInput {
  calendarId: string
  title: string
  start: Date
  end: Date
  location?: string
  description?: string
}

export class GoogleCalendarClient {
  private auth: OAuth2Client | null = null
  private calendar: calendar_v3.Calendar | null = null

  async initialize(): Promise<boolean> {
    try {
      await fs.access(CREDENTIALS_PATH)
    } catch {
      return false
    }

    try {
      const credentials = JSON.parse(await fs.readFile(CREDENTIALS_PATH, "utf-8"))
      const { client_secret, client_id } = credentials.installed
      
      // Use localhost redirect for automatic callback
      const redirectUri = `http://localhost:${REDIRECT_PORT}/oauth2callback`
      this.auth = new OAuth2Client(client_id, client_secret, redirectUri)
      
      try {
        const token = JSON.parse(await fs.readFile(TOKEN_PATH, "utf-8"))
        this.auth.setCredentials(token)
      } catch {
        await this.getNewTokenAutomatic()
      }

      this.calendar = google.calendar({ version: "v3", auth: this.auth })
      return true
    } catch (error) {
      console.error("Error initializing Google Calendar:", error)
      return false
    }
  }

  private async getNewTokenAutomatic(): Promise<void> {
    if (!this.auth) throw new Error("Auth not initialized")

    const authUrl = this.auth.generateAuthUrl({
      access_type: "offline",
      scope: SCOPES,
      redirect_uri: `http://localhost:${REDIRECT_PORT}/oauth2callback`,
    })

    console.log("\n========================================")
    console.log("Opening browser for Google authorization...")
    console.log("========================================\n")
    
    // Open browser
    const { exec } = await import("child_process")
    const platform = process.platform
    const cmd = platform === "darwin" ? "open" : platform === "win32" ? "start" : "xdg-open"
    exec(`${cmd} "${authUrl}"`)

    console.log("If the browser didn't open, visit this URL:")
    console.log(authUrl)
    console.log("\nWaiting for authorization...")

    // Start local server to receive callback
    const code = await this.startLocalServer()
    
    console.log("Authorization received! Getting access token...")
    
    const { tokens } = await this.auth.getToken(code)
    this.auth.setCredentials(tokens)
    
    await fs.mkdir(CONFIG_DIR, { recursive: true })
    await fs.writeFile(TOKEN_PATH, JSON.stringify(tokens))
    console.log("✓ Successfully authenticated with Google Calendar!")
  }

  private startLocalServer(): Promise<string> {
    return new Promise((resolve, reject) => {
      const server = http.createServer(async (req, res) => {
        try {
          const parsedUrl = url.parse(req.url || "", true)
          
          if (parsedUrl.pathname === "/oauth2callback") {
            const code = parsedUrl.query.code as string
            
            if (code) {
              // Send success page
              res.writeHead(200, { "Content-Type": "text/html" })
              res.end(`
                <!DOCTYPE html>
                <html>
                <head>
                  <meta charset="utf-8" />
                  <title>LazyCal - Authorization Success</title>
                  <style>
                    :root {
                      --bg: #141414;
                      --panel: #1c1c1c;
                      --panel-2: #232323;
                      --text: #e8e6e3;
                      --muted: #b8b4ae;
                      --border: #343434;
                      --accent: #8da399;
                    }
                    body {
                      font-family: "SF Mono", "JetBrains Mono", "Menlo", monospace;
                      display: flex;
                      justify-content: center;
                      align-items: center;
                      height: 100vh;
                      margin: 0;
                      background:
                        radial-gradient(circle at top, rgba(141, 163, 153, 0.12), transparent 38%),
                        linear-gradient(180deg, #171717 0%, #101010 100%);
                      color: var(--text);
                    }
                    .container {
                      width: min(540px, calc(100vw - 48px));
                      text-align: center;
                      padding: 32px 28px;
                      background: linear-gradient(180deg, var(--panel) 0%, var(--panel-2) 100%);
                      border: 1px solid var(--border);
                      border-radius: 18px;
                      box-shadow: 0 24px 80px rgba(0, 0, 0, 0.45);
                    }
                    .eyebrow {
                      display: inline-block;
                      margin-bottom: 16px;
                      padding: 6px 10px;
                      border: 1px solid var(--border);
                      border-radius: 999px;
                      color: var(--muted);
                      background: rgba(255, 255, 255, 0.02);
                      font-size: 12px;
                      letter-spacing: 0.08em;
                      text-transform: uppercase;
                    }
                    h1 {
                      margin: 0 0 12px 0;
                      font-size: 32px;
                      line-height: 1.1;
                    }
                    p {
                      margin: 0;
                      color: var(--muted);
                      font-size: 15px;
                      line-height: 1.6;
                    }
                    .status {
                      width: 72px;
                      height: 72px;
                      margin: 0 auto 18px auto;
                      border-radius: 16px;
                      border: 1px solid var(--border);
                      background: rgba(141, 163, 153, 0.12);
                      color: var(--accent);
                      display: grid;
                      place-items: center;
                      font-size: 28px;
                      font-weight: 700;
                    }
                  </style>
                </head>
                <body>
                  <div class="container">
                    <div class="eyebrow">LazyCal</div>
                    <div class="status">OK</div>
                    <h1>Authorization complete</h1>
                    <p>You can close this window and return to LazyCal.</p>
                  </div>
                </body>
                </html>
              `)
              
              server.close()
              resolve(code)
            } else {
              res.writeHead(400, { "Content-Type": "text/html" })
              res.end("<h1>Authorization failed</h1><p>No code received.</p>")
              server.close()
              reject(new Error("No authorization code received"))
            }
          }
        } catch (error) {
          server.close()
          reject(error)
        }
      })

      server.listen(REDIRECT_PORT, () => {
        console.log(`Waiting for OAuth callback on port ${REDIRECT_PORT}...`)
      })

      // Timeout after 5 minutes
      setTimeout(() => {
        server.close()
        reject(new Error("Authorization timeout"))
      }, 5 * 60 * 1000)
    })
  }

  async fetchEventsFromCalendars(
    date: Date,
    calendarIds: string[],
    range?: { start: Date; end: Date }
  ): Promise<CalendarEvent[]> {
    if (!this.calendar) {
      throw new Error("Calendar not initialized")
    }

    const timeMin = (range?.start || startOfWeek(date, { weekStartsOn: 0 })).toISOString()
    const timeMax = (range?.end || endOfWeek(date, { weekStartsOn: 0 })).toISOString()

    const allEvents: CalendarEvent[] = []

    for (const calendarId of calendarIds) {
      try {
        const response = await this.calendar.events.list({
          calendarId,
          timeMin,
          timeMax,
          singleEvents: true,
          orderBy: "startTime",
        })

        const events = response.data.items || []
        
        events.forEach(event => {
          const startRaw = event.start?.dateTime || event.start?.date
          const endRaw = event.end?.dateTime || event.end?.date
          const startDate = startRaw ? new Date(startRaw) : new Date()
          const endDate = endRaw ? new Date(endRaw) : null
          const isAllDay = !event.start?.dateTime

          allEvents.push({
            id: event.id || "",
            title: event.summary || "(No title)",
            date: startDate,
            start: startDate,
            end: endDate,
            isAllDay,
            time: event.start?.dateTime 
              ? this.formatTime(startDate)
              : undefined,
            description: event.description || undefined,
            location: event.location || undefined,
            calendarId: calendarId,
          })
        })
      } catch (error) {
        console.error(`Error fetching events from calendar ${calendarId}:`, error)
      }
    }

    return allEvents
  }

  private formatTime(date: Date): string {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
  }

  async listCalendars(): Promise<{ id: string; name: string }[]> {
    if (!this.calendar) {
      throw new Error("Calendar not initialized")
    }

    try {
      const response = await this.calendar.calendarList.list()
      const calendars = response.data.items || []
      
      return calendars.map(cal => ({
        id: cal.id || "",
        name: cal.summary || "(No name)",
      }))
    } catch (error) {
      console.error("Error fetching calendars:", error)
      return []
    }
  }

  async createEvent(input: CreateCalendarEventInput): Promise<CalendarEvent> {
    if (!this.calendar) {
      throw new Error("Calendar not initialized")
    }

    let response: calendar_v3.Schema$Event
    try {
      const insertResponse = await this.calendar.events.insert({
        calendarId: input.calendarId,
        requestBody: {
          summary: input.title,
          location: input.location || undefined,
          description: input.description || undefined,
          start: {
            dateTime: input.start.toISOString(),
          },
          end: {
            dateTime: input.end.toISOString(),
          },
        },
      })
      response = insertResponse.data
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (
        message.includes("insufficient") ||
        message.includes("permission") ||
        message.includes("scope")
      ) {
        throw new Error("Re-auth needed. Delete ~/.config/lazycal/token.json, then sign in again.")
      }
      throw error
    }

    const createdEvent = response
    const startRaw = createdEvent.start?.dateTime || createdEvent.start?.date
    const endRaw = createdEvent.end?.dateTime || createdEvent.end?.date
    const startDate = startRaw ? new Date(startRaw) : input.start
    const endDate = endRaw ? new Date(endRaw) : input.end
    const isAllDay = !createdEvent.start?.dateTime

    return {
      id: createdEvent.id || "",
      title: createdEvent.summary || input.title,
      date: startDate,
      start: startDate,
      end: endDate,
      isAllDay,
      time: createdEvent.start?.dateTime ? this.formatTime(startDate) : undefined,
      description: createdEvent.description || input.description || undefined,
      location: createdEvent.location || input.location || undefined,
      calendarId: input.calendarId,
    }
  }
}

// Helper function to generate sample events (fallback when no Google Calendar)
export function generateSampleEvents(): CalendarEvent[] {
  const events: CalendarEvent[] = []
  const today = new Date()
  const titles = [
    "Team Standup",
    "Client Meeting",
    "Code Review",
    "Lunch with Sarah",
    "Project Planning",
    "Design Review",
    "Sprint Retrospective",
    "1:1 with Manager",
    "Demo Presentation",
    "Deployment",
  ]

  // Add some random events
  for (let i = -14; i < 14; i++) {
    if (Math.random() > 0.6) {
      const date = new Date(today)
      date.setDate(today.getDate() + i)
      
      // Random hour between 9 and 17
      const hour = 9 + Math.floor(Math.random() * 8)
      date.setHours(hour, 0, 0, 0)
      const end = new Date(date)
      end.setMinutes(end.getMinutes() + (Math.random() > 0.5 ? 30 : 60))
      
      events.push({
        id: `event-${i}`,
        title: titles[Math.floor(Math.random() * titles.length)],
        date: date,
        start: date,
        end,
        isAllDay: false,
        time: `${hour.toString().padStart(2, "0")}:00`,
        description: "Sample event description",
      })
    }
  }

  return events
}
