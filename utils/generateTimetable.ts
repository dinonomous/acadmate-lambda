import { getUserCollection } from "../models/user.model";
import { ObjectId } from "mongodb";

interface Course {
  Slot: string;
  CourseCode: string;
  CourseTitle: string;
  FacultyName: string;
  RoomNo: string;
}

interface Period {
  period: string;
  timeSlot: string;
  course: Course | null;
}

interface DaySchedule {
  day: string;
  periods: Period[];
}

interface UserTimetableData {
  timetable: {
    Slot: string;
    CourseCode: string;
    CourseTitle: string;
    FacultyName: string;
    RoomNo: string;
  }[];
}

interface WeeklySchedule {
  day: string;
  periods: {
    period: string;
    timeSlot: string;
  }[];
}

interface UserTimetableData {
  timetable: {
    Slot: string;
    CourseCode: string;
    CourseTitle: string;
    FacultyName: string;
    RoomNo: string;
  }[];
}

export default async function generateAndStoreTimetable(
  userId: string | ObjectId,
  userData: UserTimetableData,
  weeklySchedule: WeeklySchedule[]
): Promise<DaySchedule[]> {
  try {
    if (!userId || !userData?.timetable || !weeklySchedule) {
      throw new Error("Invalid input parameters");
    }

    const slotMap: { [key: string]: Course } = {};

    for (const entry of userData.timetable.slice(1)) {
      const course: Course = {
        Slot: entry.Slot,
        CourseCode: entry.CourseCode,
        CourseTitle: entry.CourseTitle,
        FacultyName: entry.FacultyName,
        RoomNo: entry.RoomNo,
      };

      const normalizedSlot = entry.Slot.toUpperCase()
        .replace(/\s+/g, "")
        .replace(/\/+/g, "/");

      const slotParts = normalizedSlot.split(/[-/]/).filter((p) => p);

      for (const part of slotParts) {
        const baseSlot = part.split("/")[0].trim();
        if (baseSlot) {
          slotMap[baseSlot] = course;

          const xSlot = `${baseSlot}/X`;
          slotMap[xSlot] = course;
        }
      }
    }

    const generatedTimetable: DaySchedule[] = weeklySchedule.map(
      (daySchedule) => ({
        day: daySchedule.day,
        periods: daySchedule.periods.map((period) => {
          const normalizedPeriod = period.period
            .toUpperCase()
            .replace(/\s+/g, "")
            .replace(/\/+/g, "/");

          const basePeriod = normalizedPeriod.split("/")[0];
          const xPeriod = `${basePeriod}/X`;

          return {
            period: period.period,
            timeSlot: period.timeSlot.replace("\t", " "),
            course:
              slotMap[normalizedPeriod] ||
              slotMap[basePeriod] ||
              slotMap[xPeriod] ||
              null,
          };
        }),
      })
    );

    const usersCollection = await getUserCollection();
    await usersCollection.updateOne(
      { _id: typeof userId === "string" ? new ObjectId(userId) : userId },
      { $set: { timetable: generatedTimetable } }
    );

    return generatedTimetable;
  } catch (error) {
    console.error(`Error generating timetable for user ${userId}:`, error);
    throw new Error("Failed to generate and store timetable");
  }
}
