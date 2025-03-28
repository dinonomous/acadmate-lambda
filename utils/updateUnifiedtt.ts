import axios from "axios";
import * as cheerio from "cheerio";
import { User } from "../models/user.model";
import { Types } from "mongoose";

interface TimeTableEntry {
  day: string;
  periods: Array<{
    period: string;
    timeSlot: string;
  }>;
}

function decodeEncodedString(encodedString: string): string {
  return encodedString.replace(
    /\\x([0-9A-Fa-f]{2})/g,
    (match: string, p1: string) => String.fromCharCode(parseInt(p1, 16))
  );
}

function extractTextBetweenWords(
  text: string,
  startWord: string,
  endWord: string
): string | null {
  const startIndex = text.indexOf(startWord);
  const endIndex = text.indexOf(endWord);
  if (startIndex !== -1 && endIndex !== -1 && startIndex < endIndex) {
    return text.substring(startIndex + startWord.length, endIndex).trim();
  } else {
    return null;
  }
}

export const updateUnifiedtt = async (
  userId: string | Types.ObjectId,
  cookies: string,
  batch: string
): Promise<TimeTableEntry[] | undefined> => {
  try {
    if (!batch) {
      console.error("Batch not provided");
      return;
    }

    const batchNumber = parseInt(batch, 10);
    let unifiedTimeTableUrl: string;
    if (batchNumber === 1) {
      unifiedTimeTableUrl =
        "https://academia.srmist.edu.in/srm_university/academia-academic-services/page/Unified_Time_Table_2024_Batch_1";
    } else {
      unifiedTimeTableUrl =
        "https://academia.srmist.edu.in/srm_university/academia-academic-services/page/Unified_Time_Table_2024_batch_2";
    }

    const response = await axios.get(unifiedTimeTableUrl, {
      headers: {
        Accept: "*/*",
        Cookie: cookies,
        Host: "academia.srmist.edu.in",
        Origin: "https://academia.srmist.edu.in",
        Referer: "https://academia.srmist.edu.in/",
      },
    });

    if (response.status === 200 && response.data) {
      const decodedHTML = decodeEncodedString(response.data);
      const extractedHTML = extractTextBetweenWords(
        decodedHTML,
        "</style>\n",
        "');function doaction(recType) { }</script>"
      );

      if (extractedHTML) {
        const $ = cheerio.load(extractedHTML);
        const timeTableEntries: TimeTableEntry[] = [];

        $("tr").each((_, element) => {
          const cells = $(element).find("td");
          if (cells.length > 0) {
            const day = $(cells[0]).text().trim();
            if (day.startsWith("Day")) {
              const periods: { period: string; timeSlot: string }[] = [];
              cells.each((i, cell) => {
                if (i > 0) {
                  const period = $(cell).text().trim();
                  const timeSlot = $("tr:first-child > td").eq(i).text().trim();
                  periods.push({
                    period,
                    timeSlot,
                  });
                }
              });
              timeTableEntries.push({
                day,
                periods,
              });
            }
          }
        });

        return timeTableEntries;
      } else {
        return [];
      }
    }
  } catch (error) {
    console.error("Failed to fetch unified timetable:", error);
    throw error;
  }
};
