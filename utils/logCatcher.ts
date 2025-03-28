import { diff, Diff } from "deep-diff";
import { User } from "../models/user.model";
import { Types } from "mongoose";

interface ChangeLog {
  type: string;
  courseCode?: string;
  component?: string;
  courseName?: string;
  activity: string;
  changeType: string;
  oldValue?: any;
  newValue?: any;
  timestamp?: string;
}

interface CourseData {
  "Course Code": string;
  "Course Title": string;
  "Test Performance"?: Record<string, any[]>;
}

export const findDiff = async (
  userId: string | Types.ObjectId,
  oldRes: any,
  newRes: any
) => {
  try {
    const differences = diff(oldRes, newRes);
    const courseNameMap = new Map<string, string>();
    const user = await User.findById(userId).exec();
    const updates: ChangeLog[] = user?.logs || [];
    if (!user) {
      throw new Error(`User with ID ${userId} not found`);
    }
    const getISTTimestamp = () => {
      return new Date().toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour12: false,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    };

    const processCourses = (courses: CourseData[]) => {
      courses?.forEach((course) => {
        const rawCode = course["Course Code"];
        const normalizedCode = rawCode.replace(/Regular\s*$/, "").trim();

        if (normalizedCode && course["Course Title"]) {
          courseNameMap.set(normalizedCode, course["Course Title"]);
        }
      });
    };

    processCourses(newRes.attendance);
    processCourses(oldRes.attendance);
    differences?.forEach((difference: Diff<any>) => {
      if (!difference.path) return;
      const [primaryField] = difference.path;
      if (primaryField === "attendance") {
        const log: ChangeLog = {
          type: "attendance",
          activity: difference.path[2]?.toString() || "unknown",
          changeType: difference.kind,
          oldValue: "lhs" in difference ? difference.lhs : undefined,
          newValue: "rhs" in difference ? difference.rhs : undefined,
          timestamp: getISTTimestamp(),
        };
        updates.unshift(log);
      }
      if (primaryField === "marks") {
        const marksIndex = difference.path[1];
        const courseCode =
          newRes.marks?.[marksIndex]?.["Course Code"] ||
          oldRes.marks?.[marksIndex]?.["Course Code"] ||
          "Unknown Course";

        const courseName = courseNameMap.get(courseCode) || "Unknown Course";

        if (difference.path[2] === "Test Performance") {
          const component =
            difference.path[3]?.toString() || "Unknown Component";
          const arrayIndex = difference.path[4] ?? "N/A";

          const activityMessages: Record<string, string> = {
            N: `New ${component} entry added`,
            E: `${component} score updated at index ${arrayIndex}`,
            D: `${component} entry removed from index ${arrayIndex}`,
            A: `${component} array modified`,
          };

          const log: ChangeLog = {
            type: "marks",
            courseCode,
            courseName,
            component,
            activity: activityMessages[difference.kind] || "Change detected",
            changeType: difference.kind,
            oldValue: "lhs" in difference ? difference.lhs : undefined,
            newValue: "rhs" in difference ? difference.rhs : undefined,
            timestamp: getISTTimestamp(),
          };
          updates.unshift(log);
        } else if (difference.kind === "N" || difference.kind === "D") {
          const log: ChangeLog = {
            type: "marks",
            courseCode,
            courseName,
            activity:
              difference.kind === "N" ? "Component added" : "Component removed",
            changeType: difference.kind,
            oldValue: "lhs" in difference ? difference.lhs : undefined,
            newValue: "rhs" in difference ? difference.rhs : undefined,
          };
          updates.unshift(log);
        } else if (typeof difference.path[2] === "string") {
          const fieldName = difference.path[2];
          const log: ChangeLog = {
            type: "marks",
            courseCode,
            courseName,
            component: fieldName,
            activity: "Metadata updated",
            changeType: difference.kind,
            oldValue: "lhs" in difference ? difference.lhs : undefined,
            newValue: "rhs" in difference ? difference.rhs : undefined,
            timestamp: getISTTimestamp(),
          };
          updates.unshift(log);
        }
      }
    });
    console.log("Detected changes:", updates);
    if (updates.length > 15) {
      updates.length = 15;
    }

    await User.findByIdAndUpdate(
      userId,
      { $set: { logs: updates } },
      { new: true }
    );
  } catch (error) {
    console.error("Error finding differences:", error);
    throw new Error(
      `Diff analysis failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
};
