import { decode } from "he";
import * as cheerio from "cheerio";
import { getUserCollection } from "../models/user.model";
import { ObjectId } from "mongodb";

export const updateCalender = async (
  userId: string | ObjectId,
  cookies: string
) => {
  try {
    if (!userId) {
      console.error("Unauthorized: user id not provided");
      return;
    }
    const usersCollection = await getUserCollection();
    const user = await usersCollection.findOne({ _id: typeof userId === "string" ? new ObjectId(userId) : userId })
    if (!user) {
      console.error("User not found for id:", userId);
      return;
    }

    const timetableResponse = await fetch(
      "https://academia.srmist.edu.in/srm_university/academia-academic-services/page/Academic_Planner_2024_25_EVEN",
      {
        method: "GET",
        headers: new Headers({
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,/;q=0.8",
          Cookie: cookies,
          Host: "academia.srmist.edu.in",
          Origin: "https://academia.srmist.edu.in",
          Referer: "https://academia.srmist.edu.in/",
        }),
        redirect: "follow"
      }
    );

    if (timetableResponse.status === 200) {
      const responseText = await timetableResponse.text()
      const rawHtml = responseText;
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

      await usersCollection.updateOne(
        { _id: typeof userId === "string" ? new ObjectId(userId) : userId },
        {
          $set: {
            calendar: finalCalendar,
          },
        },
      );
    } else {
      return;
    }
  } catch (error) {
    console.error("Error fetching timetable data:", error);
    throw error;
  }
};
