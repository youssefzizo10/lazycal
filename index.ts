import {
  createCliRenderer,
  BoxRenderable,
  TextRenderable,
  ScrollBoxRenderable,
  type KeyEvent,
} from "@opentui/core"
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, addMonths, subMonths, getDay, getDate } from "date-fns"
import { GoogleCalendarClient, generateSampleEvents, type CalendarEvent } from "./google-calendar"

// Color themes
const COLORS = {
  bg: "#1E1E1E",
  fg: "#E2E8F0",
  headerBg: "#2D3748",
  headerFg: "#F7FAFC",
  dayHeaderBg: "#4A5568",
  dayHeaderFg: "#CBD5E0",
  selectedBg: "#3182CE",
  selectedFg: "#FFFFFF",
  todayBg: "#2C5282",
  todayFg: "#FFFFFF",
  otherMonthFg: "#718096",
  weekendBg: "#2D3748",
  border: "#4A5568",
  eventDot: "#48BB78",
  scrollBg: "#2D3748",
  scrollThumb: "#4A5568",
  synced: "#48BB78",
  offline: "#F6AD55",
}

class GoogleCalendarTUI {
  private renderer: Awaited<ReturnType<typeof createCliRenderer>>
  private currentDate: Date
  private selectedDate: Date
  private events: CalendarEvent[]
  private calendarGrid: (Date | null)[][] = []
  private googleClient: GoogleCalendarClient
  private isGoogleConnected = false

  // UI Components
  private rootBox: BoxRenderable | null = null
  private headerBox: BoxRenderable | null = null
  private calendarBox: BoxRenderable | null = null
  private eventsBox: BoxRenderable | null = null
  private eventsScrollBox: ScrollBoxRenderable | null = null

  constructor() {
    this.currentDate = new Date()
    this.selectedDate = new Date()
    this.events = generateSampleEvents()
    this.googleClient = new GoogleCalendarClient()
  }

  async init() {
    // Try to connect to Google Calendar
    console.log("Checking for Google Calendar credentials...")
    this.isGoogleConnected = await this.googleClient.initialize()
    
    if (this.isGoogleConnected) {
      console.log("Connected to Google Calendar! Fetching events...")
      this.events = await this.googleClient.fetchEvents(this.currentDate)
    } else {
      console.log("Using sample data. Add credentials to use real Google Calendar.")
    }

    this.renderer = await createCliRenderer({
      exitOnCtrlC: true,
      targetFps: 30,
    })

    this.renderer.setBackgroundColor(COLORS.bg)
    this.buildCalendarGrid()
    this.createLayout()
    this.setupKeyboardHandling()
    this.renderer.requestRender()
  }

  private buildCalendarGrid() {
    const monthStart = startOfMonth(this.currentDate)
    const monthEnd = endOfMonth(this.currentDate)
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 })
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })

    this.calendarGrid = []
    let week: (Date | null)[] = []
    let currentDay = calendarStart

    // Fill in leading empty days
    const startDayOfWeek = getDay(calendarStart)
    for (let i = 0; i < startDayOfWeek; i++) {
      week.push(null)
    }

    while (currentDay <= calendarEnd) {
      week.push(new Date(currentDay))
      
      if (week.length === 7) {
        this.calendarGrid.push(week)
        week = []
      }
      currentDay = addDays(currentDay, 1)
    }

    // Fill remaining slots
    while (week.length < 7 && week.length > 0) {
      week.push(null)
    }
    if (week.length > 0) {
      this.calendarGrid.push(week)
    }
  }

  private createLayout() {
    // Main container
    this.rootBox = new BoxRenderable(this.renderer, {
      id: "root",
      width: "100%",
      height: "100%",
      flexDirection: "column",
      backgroundColor: COLORS.bg,
    })
    this.renderer.root.add(this.rootBox)

    // Header with month/year and navigation hints
    this.headerBox = new BoxRenderable(this.renderer, {
      id: "header",
      height: 3,
      flexShrink: 0,
      flexDirection: "column",
      backgroundColor: COLORS.headerBg,
      padding: 1,
    })
    this.rootBox.add(this.headerBox)

    // Month/Year title with sync status
    const statusIcon = this.isGoogleConnected ? "●" : "○"
    const statusColor = this.isGoogleConnected ? COLORS.synced : COLORS.offline
    const statusText = this.isGoogleConnected ? "Google Calendar" : "Sample Data"
    
    const titleText = new TextRenderable(this.renderer, {
      id: "month-title",
      content: `${format(this.currentDate, "MMMM yyyy")}  ${statusIcon} ${statusText}`,
      fg: COLORS.headerFg,
      alignSelf: "center",
    })
    this.headerBox.add(titleText)

    // Navigation hints
    const hintsText = new TextRenderable(this.renderer, {
      id: "hints",
      content: "← → or h/l: Change month  |  ↑ ↓ or k/j: Navigate  |  Enter: View day  |  t: Today  |  q: Quit",
      fg: COLORS.dayHeaderFg,
      alignSelf: "center",
    })
    this.headerBox.add(hintsText)

    // Main content area with calendar and events
    const contentBox = new BoxRenderable(this.renderer, {
      id: "content",
      flexGrow: 1,
      flexDirection: "row",
    })
    this.rootBox.add(contentBox)

    // Calendar container
    this.calendarBox = new BoxRenderable(this.renderer, {
      id: "calendar-container",
      flexGrow: 1,
      flexDirection: "column",
      padding: 1,
      gap: 0,
    })
    contentBox.add(this.calendarBox)

    // Day headers (Sun, Mon, Tue, etc.)
    const dayHeadersBox = new BoxRenderable(this.renderer, {
      id: "day-headers",
      height: 1,
      flexShrink: 0,
      flexDirection: "row",
      gap: 1,
    })
    this.calendarBox.add(dayHeadersBox)

    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    dayNames.forEach((day, index) => {
      const isWeekend = index === 0 || index === 6
      const dayHeader = new BoxRenderable(this.renderer, {
        id: `day-header-${index}`,
        flexGrow: 1,
        height: 1,
        backgroundColor: isWeekend ? COLORS.weekendBg : COLORS.dayHeaderBg,
      })
      const dayText = new TextRenderable(this.renderer, {
        id: `day-header-text-${index}`,
        content: day,
        fg: COLORS.dayHeaderFg,
        alignSelf: "center",
      })
      dayHeader.add(dayText)
      dayHeadersBox.add(dayHeader)
    })

    // Calendar grid
    const gridBox = new BoxRenderable(this.renderer, {
      id: "calendar-grid",
      flexGrow: 1,
      flexDirection: "column",
      gap: 0,
    })
    this.calendarBox.add(gridBox)

    // Render calendar weeks
    this.calendarGrid.forEach((week, weekIndex) => {
      const weekBox = new BoxRenderable(this.renderer, {
        id: `week-${weekIndex}`,
        flexGrow: 1,
        flexDirection: "row",
        gap: 1,
      })
      gridBox.add(weekBox)

      week.forEach((day, dayIndex) => {
        const isWeekend = dayIndex === 0 || dayIndex === 6
        const isSelected = day && isSameDay(day, this.selectedDate)
        const isToday = day && isSameDay(day, new Date())
        const isOtherMonth = day && !isSameMonth(day, this.currentDate)
        const hasEvents = day && this.getEventsForDate(day).length > 0

        let bgColor = isWeekend ? COLORS.weekendBg : COLORS.bg
        let fgColor = isOtherMonth ? COLORS.otherMonthFg : COLORS.fg

        if (isSelected) {
          bgColor = COLORS.selectedBg
          fgColor = COLORS.selectedFg
        } else if (isToday) {
          bgColor = COLORS.todayBg
          fgColor = COLORS.todayFg
        }

        const dayBox = new BoxRenderable(this.renderer, {
          id: `day-${weekIndex}-${dayIndex}`,
          flexGrow: 1,
          backgroundColor: bgColor,
          border: true,
          borderStyle: isSelected || isToday ? "double" : "single",
          borderColor: isSelected ? COLORS.selectedFg : COLORS.border,
          padding: 0,
        })
        weekBox.add(dayBox)

        if (day) {
          // Day number
          const dayText = new TextRenderable(this.renderer, {
            id: `day-text-${weekIndex}-${dayIndex}`,
            content: String(getDate(day)),
            fg: fgColor,
            marginTop: 0,
            marginLeft: 1,
          })
          dayBox.add(dayText)

          // Event indicator
          if (hasEvents) {
            const eventIndicator = new TextRenderable(this.renderer, {
              id: `event-indicator-${weekIndex}-${dayIndex}`,
              content: "●",
              fg: COLORS.eventDot,
              position: "absolute",
              right: 1,
              top: 0,
            })
            dayBox.add(eventIndicator)
          }
        }
      })
    })

    // Events sidebar/panel
    this.eventsBox = new BoxRenderable(this.renderer, {
      id: "events-box",
      width: 35,
      flexShrink: 0,
      flexDirection: "column",
      border: true,
      borderStyle: "single",
      borderColor: COLORS.border,
      backgroundColor: COLORS.headerBg,
      padding: 1,
    })
    contentBox.add(this.eventsBox)

    // Selected date header
    const selectedDateHeader = new TextRenderable(this.renderer, {
      id: "selected-date-header",
      content: format(this.selectedDate, "EEEE, MMM d"),
      fg: COLORS.headerFg,
      marginBottom: 1,
    })
    this.eventsBox.add(selectedDateHeader)

    // Events list
    this.eventsScrollBox = new ScrollBoxRenderable(this.renderer, {
      id: "events-scroll",
      flexGrow: 1,
      backgroundColor: "transparent",
      scrollBarColor: COLORS.scrollThumb,
      scrollBarBackgroundColor: COLORS.scrollBg,
    })
    this.eventsBox.add(this.eventsScrollBox)

    this.updateEventsList()
  }

  private getEventsForDate(date: Date): CalendarEvent[] {
    return this.events.filter(event => isSameDay(event.date, date))
  }

  private updateEventsList() {
    if (!this.eventsScrollBox) return

    // Remove existing events - get all children IDs first, then remove
    const children = this.eventsScrollBox.getChildren()
    const childIds = children.map(child => child.id)
    childIds.forEach(id => {
      this.eventsScrollBox?.remove(id)
    })

    const dayEvents = this.getEventsForDate(this.selectedDate)

    if (dayEvents.length === 0) {
      const noEventsText = new TextRenderable(this.renderer, {
        id: "no-events",
        content: "No events for this day",
        fg: COLORS.otherMonthFg,
        alignSelf: "center",
        marginTop: 2,
      })
      this.eventsScrollBox.add(noEventsText)
    } else {
      dayEvents.forEach((event, index) => {
        const eventBox = new BoxRenderable(this.renderer, {
          id: `event-${index}`,
          width: "100%",
          flexShrink: 0,
          backgroundColor: index % 2 === 0 ? COLORS.bg : "transparent",
          padding: 1,
          marginBottom: 1,
          border: true,
          borderStyle: "single",
          borderColor: COLORS.border,
        })

        const eventTime = new TextRenderable(this.renderer, {
          id: `event-time-${index}`,
          content: event.time || "All day",
          fg: COLORS.eventDot,
        })
        eventBox.add(eventTime)

        const eventTitle = new TextRenderable(this.renderer, {
          id: `event-title-${index}`,
          content: event.title,
          fg: COLORS.fg,
          marginTop: 0,
        })
        eventBox.add(eventTitle)

        this.eventsScrollBox.add(eventBox)
      })
    }

    // Update selected date header
    const selectedDateHeader = this.eventsBox?.getRenderable("selected-date-header") as TextRenderable
    if (selectedDateHeader) {
      selectedDateHeader.content = format(this.selectedDate, "EEEE, MMM d")
    }

    this.renderer.requestRender()
  }

  private async refreshCalendar() {
    // Destroy existing rootBox and recreate the layout
    if (this.rootBox) {
      this.rootBox.destroyRecursively()
    }
    this.buildCalendarGrid()
    this.createLayout()
    
    // If connected to Google Calendar, fetch new events for the month
    if (this.isGoogleConnected) {
      try {
        this.events = await this.googleClient.fetchEvents(this.currentDate)
        this.updateEventsList()
      } catch (error) {
        console.error("Error fetching events:", error)
      }
    }
    
    this.renderer.requestRender()
  }

  private setupKeyboardHandling() {
    this.renderer.keyInput.on("keypress", (key: KeyEvent) => {
      switch (key.name) {
        case "q":
          if (!key.ctrl) {
            this.cleanup()
          }
          break
        case "left":
        case "h":
          this.navigateMonth(-1)
          break
        case "right":
        case "l":
          this.navigateMonth(1)
          break
        case "up":
        case "k":
          this.navigateDay(-7)
          break
        case "down":
        case "j":
          this.navigateDay(7)
          break
        case "return":
        case "linefeed":
          this.viewDayDetails()
          break
        case "t":
          this.goToToday()
          break
        case "r":
          this.refreshEvents()
          break
      }
    })
  }

  private async navigateMonth(direction: number) {
    if (direction > 0) {
      this.currentDate = addMonths(this.currentDate, 1)
    } else {
      this.currentDate = subMonths(this.currentDate, 1)
    }
    this.selectedDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), 1)
    await this.refreshCalendar()
  }

  private navigateDay(days: number) {
    const newDate = addDays(this.selectedDate, days)
    this.selectedDate = newDate

    // Check if we need to change months
    if (!isSameMonth(newDate, this.currentDate)) {
      this.currentDate = newDate
      this.refreshCalendar()
    } else {
      // Just update the selection - destroy and recreate
      if (this.rootBox) {
        this.rootBox.destroyRecursively()
      }
      this.buildCalendarGrid()
      this.createLayout()
      this.renderer.requestRender()
    }
  }

  private goToToday() {
    this.currentDate = new Date()
    this.selectedDate = new Date()
    this.refreshCalendar()
  }

  private async refreshEvents() {
    if (this.isGoogleConnected) {
      console.log("\nRefreshing events from Google Calendar...")
      this.events = await this.googleClient.fetchEvents(this.currentDate)
      this.updateEventsList()
      console.log("Events refreshed!\n")
    }
  }

  private viewDayDetails() {
    const events = this.getEventsForDate(this.selectedDate)
    console.log(`\nEvents for ${format(this.selectedDate, "MMMM d, yyyy")}:`)
    if (events.length === 0) {
      console.log("  No events")
    } else {
      events.forEach(event => {
        console.log(`  ${event.time || "All day"}: ${event.title}`)
        if (event.description) {
          console.log(`    ${event.description}`)
        }
        if (event.location) {
          console.log(`    📍 ${event.location}`)
        }
      })
    }
    console.log("")
  }

  private cleanup() {
    this.renderer.destroy()
    process.exit(0)
  }
}

// Run the application
const app = new GoogleCalendarTUI()
app.init().catch(console.error)
