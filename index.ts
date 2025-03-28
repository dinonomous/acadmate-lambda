import mongoose from "mongoose";
import { User, IUser } from "./models/user.model";
import { updateAttendance } from "./utils/updateAttendance";
import { updateTimetable } from "./utils/updateTimetable";
import { updateUnifiedtt } from "./utils/updateUnifiedtt";
import { updateCalender } from "./utils/updateCalendar";
import generateTimetable from "./utils/generateTimetable";

const MONGO_URI: string = process.env.MONGO_URI || "";

export const handler = async (): Promise<void> => {
  console.log(`Lambda triggered at ${new Date().toISOString()}`);

  if (!MONGO_URI) {
    console.error("MongoDB URI is not defined.");
    return;
  }

  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB");

    const thresholdTime = new Date(Date.now() - 60 * 60 * 1000);
    const calendarThresholdTime = new Date(Date.now() - 6 * 60 * 60 * 1000);

    const users: IUser[] = await User.find({
      lastUpdated: { $lt: thresholdTime },
    }).select("_id cookies lastUpdated batch calendarLastUpdated att");

    for (const user of users) {
      try {
        if (!user.cookies) {
          console.error(`Cookies are undefined for user ${user._id}`);
          continue;
        }
        const timetableData = await updateTimetable(user._id as string | mongoose.Types.ObjectId, user.cookies);
        const unifiedttData = await updateUnifiedtt(user._id as string | mongoose.Types.ObjectId, user.cookies, user.batch ?? "");

        const updatePromises: Promise<any>[] = [
          updateAttendance(user._id as string | mongoose.Types.ObjectId, user.cookies, user.att || {}),
        ];
        if ((user.calendarLastUpdated ?? new Date(0)) < calendarThresholdTime) {
          updatePromises.push(updateCalender(user._id as string | mongoose.Types.ObjectId, user.cookies));
        }

        if (timetableData && unifiedttData) {
          await generateTimetable(user._id as string | mongoose.Types.ObjectId, timetableData, unifiedttData || []);
        } else {
          console.error(`Timetable data is undefined for user ${user._id}`);
        }

        await Promise.allSettled(updatePromises);
        await User.findByIdAndUpdate(user._id, { $set: { lastUpdated: new Date() } });
        console.log(`Updated data for user ${user._id}`);
      } catch (userErr) {
        console.error(`Error updating user ${user._id}:`, userErr);
      }
    }

    await mongoose.connection.close();
    console.log("MongoDB connection closed.");
  } catch (error) {
    console.error("Error retrieving users:", error);
  }
};
