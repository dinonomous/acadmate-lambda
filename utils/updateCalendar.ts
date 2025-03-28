import axios from "axios";
import { decode } from "he";
import * as cheerio from "cheerio";
import { User } from "../models/user.model";
import { Types } from "mongoose";

export const updateCalender = async (
  userId: string | Types.ObjectId,
  cookies: string
) => {
  try {
    if (!userId) {
      console.error("Unauthorized: user id not provided");
      return;
    }
    const user = await User.findById(userId);
    if (!user) {
      console.error("User not found for id:", userId);
      return;
    }

    const timetableResponse = await axios.get(
      "https://academia.srmist.edu.in/srm_university/academia-academic-services/page/Academic_Planner_2024_25_EVEN",
      {
        headers: {
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,/;q=0.8",
          Cookie: cookies,
          Host: "academia.srmist.edu.in",
          Origin: "https://academia.srmist.edu.in",
          Referer: "https://academia.srmist.edu.in/",
        },
      }
    );

    if (timetableResponse.status === 200 && timetableResponse.data) {
      const rawHtml = timetableResponse.data;
      const decodedHtml = decode(rawHtml);
      const $ = cheerio.load(decodedHtml);

      const structuredData: string[][] = [];
      const $calendarTable = $('table[bgcolor="#FAFCFE"]');

      $calendarTable.find("tr").each((_rowIndex, row) => {
        const rowCells: string[] = [];
        $(row)
          .find("td")
          .each((_colIndex, cell) => {
            rowCells.push($(cell).text().trim());
          });
        if (rowCells.length > 0) {
          structuredData.push(rowCells);
        }
      });
      const numberOfMonths = 6;
      const year = 2025;

      const finalCalendar: Record<string, any[]> = {};

      for (let i = 0; i < numberOfMonths; i++) {
        const monthName = new Date(year, i).toLocaleString("default", {
          month: "long",
        });
        finalCalendar[monthName] = [];
      }

      structuredData.forEach((row) => {
        for (let i = 0; i < numberOfMonths; i++) {
          const baseIndex = i * 5;
          if (baseIndex + 4 >= row.length) {
            break;
          }
          const date = row[baseIndex] || "";
          const day = row[baseIndex + 1] || "";
          const event = row[baseIndex + 2] || "";
          const dayOrder = row[baseIndex + 3] || "";
          if (!date.trim()) {
            continue;
          }
          const monthName = new Date(year, i).toLocaleString("default", {
            month: "long",
          });

          finalCalendar[monthName].push({
            Date: date,
            Day: day,
            DayOrder: dayOrder,
            Event: event,
          });
        }
      });

      await User.findByIdAndUpdate(
        userId,
        {
          $set: {
            calendar: finalCalendar,
          },
        },
        { new: true }
      );
    } else {
      return;
    }
  } catch (error) {
    console.error("Error fetching timetable data:", error);
    throw error;
  }
};
