import axios from "axios";
import * as cheerio from "cheerio";
import { User } from "../models/user.model";
import { Types } from "mongoose";
// import { findDiff } from "./logCatcher";

interface ResponseData {
  user: Array<{ [key: string]: string }>;
  attendance: any[];
  marks: any[];
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

export const updateAttendance = async (
  userId: string | Types.ObjectId,
  cookies: string,
  att: { attendance: []; marks: [] }
): Promise<void> => {
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
    const attendanceResponse = await axios.get(
      "https://academia.srmist.edu.in/srm_university/academia-academic-services/page/My_Attendance",
      {
        headers: {
          Accept: "*/*",
          Cookie: cookies,
          Host: "academia.srmist.edu.in",
          Origin: "https://academia.srmist.edu.in",
          Referer: "https://academia.srmist.edu.in/",
        },
      }
    );
    if (attendanceResponse.status === 200 && attendanceResponse.data) {
      const decodedHTML = decodeEncodedString(attendanceResponse.data);
      const result = extractTextBetweenWords(
        decodedHTML,
        "</style>\n",
        "');function doaction(recType) { }</script>"
      );
      let responseData: ResponseData = { user: [], attendance: [], marks: [] };

      if (result) {
        const $ = cheerio.load(result);
        $("div.cntdDiv > div > table:nth-child(2) > tbody > tr").each(
          (i, row) => {
            const details = $(row)
              .find("td")
              .map((_, td) => $(td).text().trim())
              .get();
            if (details?.length > 1) {
              const [detail, value] = details;
              responseData.user.push({ [detail]: value });
            }
          }
        );
        const attendanceHeadings = [
          "Course Code",
          "Course Title",
          "Category",
          "Faculty Name",
          "Slot",
          "Hours Conducted",
          "Hours Absent",
          "Attn %",
          "University Practical Details",
        ];
        $("div.cntdDiv > div > table:nth-child(4) > tbody > tr")
          .slice(1)
          .each((i, row) => {
            const details = $(row)
              .find("td")
              .map((_, td) => $(td).text().trim())
              .get();
            if (details?.length > 1) {
              const courseData: { [key: string]: string } = {};
              attendanceHeadings.forEach((heading, index) => {
                courseData[heading] = details[index];
              });
              responseData.attendance.push(courseData);
            }
          });

        const marksHeadings = [
          "Course Code",
          "Course Type",
          "Test Performance",
        ];
        $("div.cntdDiv > div > table:nth-child(7) > tbody > tr")
          .slice(1)
          .each((i, row) => {
            const details = $(row)
              .find("td")
              .map((_, td) => $(td).text().trim())
              .get();
            if (details?.length > 1) {
              const marksData: { [key: string]: any } = {};
              marksHeadings.forEach((heading, index) => {
                if (heading === "Test Performance") {
                  marksData[heading] = parseTestPerformance(details[index]);
                } else {
                  marksData[heading] = details[index];
                }
              });
              responseData.marks.push(marksData);
            }
          });
        function parseTestPerformance(performance: string): {
          [key: string]: number[];
        } {
          const tests: { [key: string]: number[] } = {};
          const performancePattern = /([A-Za-z0-9-]+)\/(\d+\.\d{2})(\d+\.\d+)/g;
          let match;
          while ((match = performancePattern.exec(performance)) !== null) {
            const testName = match[1];
            const scores = [parseFloat(match[2]), parseFloat(match[3])];
            tests[testName] = scores;
          }
          return tests;
        }

        if (JSON.stringify(responseData) != JSON.stringify(att)) {
          // console.log("Att change triggered");
          await User.findByIdAndUpdate(
            userId,
            { $set: { att: responseData } },
            { new: true }
          );
          // if (
          //   att?.attendance?.length != 0 ||
          //   att?.marks?.length != 0 ||
          //   (att.attendance && att.marks)
          // ) {
          //   findDiff(userId, att, responseData);
          // }
        }
      } else {
        await User.findByIdAndUpdate(
          userId,
          { $set: { att: {} } },
          { new: true }
        );
      }
    } else {
      await User.findByIdAndUpdate(
        userId,
        { $set: { att: {} } },
        { new: true }
      );
    }
  } catch (err: any) {
    console.error("Error fetching/updating attendance data:", err.message);
  }
};
