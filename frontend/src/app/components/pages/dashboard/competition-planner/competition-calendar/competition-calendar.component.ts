import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CalendarOptions, FullCalendarModule } from '@fullcalendar/angular';
import dayGridPlugin from '@fullcalendar/angular/daygrid';
import classicThemePlugin from '@fullcalendar/angular/themes/classic';
import { PlannerCompetition } from 'src/app/models/PlannerCompetition';
import { getPlannerMajorHolidaysBetween } from '../competition-planner-holidays.util';
import { Colors, StateColors, States } from 'src/app/shared/types';
import { currentMonthDate } from 'src/app/shared/date.util';
import { StripYearPipe } from 'src/app/pipes/stripYear.pipe';

const SOUTHEAST_STATE_CODES = new Set([...Object.keys(States), ...Object.values(States)]);

function nextMonthDate(monthDate: string): string {
  const [year, month] = monthDate.split('-').map(Number);
  const nextMonth = new Date(year, month, 1);
  return `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`;
}

// FullCalendar treats all-day event ends as exclusive, while competition dates are inclusive.
function dayAfterDate(dateString: string): string {
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day + 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function competitionColor(competition: PlannerCompetition): Colors {
  const isNonSoutheastMajor =
    competition.is_major && !SOUTHEAST_STATE_CODES.has(competition.state ?? '');
  return isNonSoutheastMajor ? Colors.black : StateColors[competition.state ?? '??'];
}

@Component({
  selector: 'se-competition-calendar',
  templateUrl: './competition-calendar.component.html',
  styleUrls: ['./competition-calendar.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FullCalendarModule, StripYearPipe],
})
export class CompetitionCalendarComponent {
  competitions = input.required<PlannerCompetition[]>();
  showMajorHolidays = input(true);
  competitionSelected = output<PlannerCompetition>();
  holidayNamesByDate = computed(() => {
    if (!this.showMajorHolidays()) return new Map<string, string>();

    const months = this.competitions()
      .flatMap((competition) => [competition.start_date, competition.end_date])
      .filter(Boolean)
      .map((date) => date.slice(0, 7));
    months.push(currentMonthDate().slice(0, 7));
    months.sort();
    const startDate = `${months[0]}-01`;
    const endDate = nextMonthDate(`${months[months.length - 1]}-01`);
    return new Map(
      getPlannerMajorHolidaysBetween(startDate, endDate).map((holiday) => [
        holiday.date,
        holiday.name,
      ]),
    );
  });

  holidayNameForDate(date: Date): string | null {
    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return this.holidayNamesByDate().get(dateKey) ?? null;
  }

  calendarOptions = computed<CalendarOptions>(() => {
    const todayMonth = currentMonthDate().slice(0, 7);
    const competitionMonths = this.competitions()
      .flatMap((competition) => [competition.start_date, competition.end_date])
      .filter(Boolean)
      .map((date) => date.slice(0, 7));
    const boundedMonths = [...competitionMonths, todayMonth].sort();
    const firstMonth = `${boundedMonths[0]}-01`;
    const lastMonth = `${boundedMonths[boundedMonths.length - 1]}-01`;
    const competitionEvents = this.competitions().map((competition) => {
      const color = competitionColor(competition);
      return {
        id: competition.id,
        title: competition.name,
        start: competition.start_date,
        end: dayAfterDate(competition.end_date),
        allDay: true,
        backgroundColor: color,
        borderColor: color,
        textColor: color === Colors.black ? Colors.white : Colors.black,
        extendedProps: {
          chipColor: color,
          chipTextColor: color === Colors.black ? Colors.white : Colors.black,
        },
      };
    });

    return {
      plugins: [classicThemePlugin, dayGridPlugin],
      initialView: 'dayGridMonth',
      initialDate: currentMonthDate(),
      firstDay: 1,
      fixedWeekCount: false,
      headerToolbar: {
        left: '',
        center: 'title',
        right: 'today prev,next',
      },
      height: 'auto',
      events: competitionEvents,
      eventClick: ({ event }) => {
        const competition = this.competitions().find((candidate) => candidate.id === event.id);
        if (competition) this.competitionSelected.emit(competition);
      },
      validRange: {
        start: firstMonth,
        end: nextMonthDate(lastMonth),
      },
    };
  });
}
