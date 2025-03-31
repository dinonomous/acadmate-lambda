import { MongoClient, ObjectId } from "mongodb";
import { getUserCollection } from "./models/user.model";
import { updateAttendance } from "./utils/updateAttendance";
import { updateTimetable } from "./utils/updateTimetable";
import { updateUnifiedtt } from "./utils/updateUnifiedtt";
import { updateCalender } from "./utils/updateCalendar";
import generateTimetable from "./utils/generateTimetable";

export const handler = async (): Promise<void> => {
  console.log(`Lambda triggered at ${new Date().toISOString()}`);
  try {
    const usersCollection = await getUserCollection();
    
    const thresholdTime = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const calendarThresholdTime = new Date(Date.now() - 6 * 60 * 60 * 1000);

    const users = await usersCollection
      .find({ lastUpdated: { $lt: thresholdTime } })
      .project({ _id: 1, cookies: 1, lastUpdated: 1, batch: 1, calendarLastUpdated: 1, att: 1 })
      .toArray();

    for (const user of users) {
      try {
        console.log(`Updating data for user ${user._id}`);
        if (!user.cookies) {
          console.error(`Cookies are undefined for user ${user._id}`);
          continue;
        }

        const timetableData = await updateTimetable(user._id.toString(), user.cookies);
        const unifiedttData = await updateUnifiedtt(user._id.toString(), user.cookies, user.batch || "");

        const updatePromises = [
          updateAttendance(
            user._id.toString(),
            user.cookies,
            user.att && "user" in user.att && "attendance" in user.att && "marks" in user.att
              ? user.att
              : { user: [], attendance: [], marks: [] }
          ),
        ];

        if ((user.calendarLastUpdated ?? new Date(0)) < calendarThresholdTime) {
          updatePromises.push(updateCalender(user._id.toString(), user.cookies));
        }

        if (timetableData && unifiedttData) {
          await generateTimetable(user._id.toString(), timetableData, unifiedttData || []);
        } else {
          console.error(`Timetable data is undefined for user ${user._id}`);
        }

        await Promise.allSettled(updatePromises);
        await usersCollection.updateOne(
          { _id: new ObjectId(user._id) },
          { $set: { lastUpdated: new Date() } }
        );
        console.log(`Updated data for user ${user._id}`);
      } catch (userErr) {
        console.error(`Error updating user ${user._id}:`, userErr);
      }
    }
  } catch (error) {
    console.error("Error retrieving users:", error);
  }
};
