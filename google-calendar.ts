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
import { startOfMonth, endOfMonth } from "date-fns"

const SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"]
const CONFIG_DIR = path.join(homedir(), ".config", "lazycal")
const CREDENTIALS_PATH = path.join(CONFIG_DIR, "credentials.json")
const TOKEN_PATH = path.join(CONFIG_DIR, "token.json")

export interface CalendarEvent {
  id: string
  title: string
  date: Date
  time?: string
  description?: string
  location?: string
  calendarName?: string
}

export class GoogleCalendarClient {
  private auth: OAuth2Client | null = null
  private calendar: calendar_v3.Calendar | null = null

  async initialize(): Promise<boolean> {
    try {
      // Check if credentials exist
      await fs.access(CREDENTIALS_PATH)
    } catch {
      console.log("Google Calendar credentials not found.")
      console.log(`Please place your credentials.json at: ${CREDENTIALS_PATH}`)
      console.log("Using sample data instead.")
      return false
    }

    try {
      const credentials = JSON.parse(await fs.readFile(CREDENTIALS_PATH, "utf-8"))
      const { client_secret, client_id, redirect_uris } = credentials.installed
      
      this.auth = new OAuth2Client(client_id, client_secret, redirect_uris[0])
      
      // Check for existing token
      try {
        const token = JSON.parse(await fs.readFile(TOKEN_PATH, "utf-8"))
        this.auth.setCredentials(token)
      } catch {
        // Need to get new token
        await this.getNewToken()
      }

      this.calendar = google.calendar({ version: "v3", auth: this.auth })
      return true
    } catch (error) {
      console.error("Error initializing Google Calendar:", error)
      return false
    }
  }

  private async getNewToken(): Promise<void> {
    if (!this.auth) throw new Error("Auth not initialized")

    const authUrl = this.auth.generateAuthUrl({
      access_type: "offline",
      scope: SCOPES,
    })

    console.log("Authorize this app by visiting this URL:")
    console.log(authUrl)
    console.log("\nAfter authorization, you will be redirected to localhost.")
    console.log("Copy the code from the URL and paste it below:")

    // Simple prompt for the auth code
    const code = await this.promptForCode()
    
    const { tokens } = await this.auth.getToken(code)
    this.auth.setCredentials(tokens)
    
    // Save token for future use
    await fs.mkdir(CONFIG_DIR, { recursive: true })
    await fs.writeFile(TOKEN_PATH, JSON.stringify(tokens))
    console.log("Token saved successfully!")
  }

  private promptForCode(): Promise<string> {
    return new Promise((resolve) => {
      process.stdout.write("Enter the code here: ")
      process.stdin.once("data", (data) => {
        resolve(data.toString().trim())
      })
    })
  }

  async fetchEvents(date: Date): Promise<CalendarEvent[]> {
    if (!this.calendar) {
      throw new Error("Calendar not initialized")
    }

    const timeMin = startOfMonth(date).toISOString()
    const timeMax = endOfMonth(date).toISOString()

    try {
      const response = await this.calendar.events.list({
        calendarId: "primary",
        timeMin,
        timeMax,
        singleEvents: true,
        orderBy: "startTime",
      })

      const events = response.data.items || []
      
      return events.map(event => {
        const start = event.start?.dateTime || event.start?.date
        const eventDate = start ? new Date(start) : new Date()
        
        return {
          id: event.id || "",
          title: event.summary || "(No title)",
          date: eventDate,
          time: event.start?.dateTime 
            ? this.formatTime(eventDate)
            : undefined,
          description: event.description,
          location: event.location,
        }
      })
    } catch (error) {
      console.error("Error fetching events:", error)
      return []
    }
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

  // Add some random events within the current month and adjacent months
  for (let i = -30; i < 30; i++) {
    if (Math.random() > 0.7) {
      const date = new Date(today)
      date.setDate(today.getDate() + i)
      events.push({
        id: `event-${i}`,
        title: titles[Math.floor(Math.random() * titles.length)],
        date: date,
        time: `${9 + Math.floor(Math.random() * 8)}:00`,
        description: "Sample event description",
      })
    }
  }

  return events
}
