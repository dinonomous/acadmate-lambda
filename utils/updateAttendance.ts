import * as cheerio from "cheerio";
import { getUserCollection } from "../models/user.model";
import { ObjectId } from "mongodb";

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
  userId: string | ObjectId,
  cookies: string,
  att: ResponseData
): Promise<void> => {
  try {
    if (!userId) {
      console.error("Unauthorized: user id not provided");
      return;
    }
    const usersCollection = await getUserCollection();
    const user = await usersCollection.findOne({ _id: typeof userId === "string" ? new ObjectId(userId) : userId });
    if (!user) {
      console.error("User not found for id:", userId);
      return;
    }
    const attendanceResponse = await fetch(
      "https://academia.srmist.edu.in/srm_university/academia-academic-services/page/My_Attendance",
      {
        method: "GET",
        headers: new Headers({
          "Accept": "*/*",
          "Cookie": cookies,
          "Host": "academia.srmist.edu.in",
          "Origin": "https://academia.srmist.edu.in",
          "Referer": "https://academia.srmist.edu.in/",
        }),
        redirect: "follow"
      }
    );
    if (attendanceResponse.status === 200) {
      const responseText = await attendanceResponse.text();
      const decodedHTML = decodeEncodedString(responseText);
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
          await usersCollection.updateOne(
            { _id: typeof userId === "string" ? new ObjectId(userId) : userId },
            { $set: { att: responseData } }
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
        await usersCollection.updateOne(
          { _id: typeof userId === "string" ? new ObjectId(userId) : userId },
          { $set: { att: att } }
        );
      }
    } else {
      await usersCollection.updateOne(
        { _id: typeof userId === "string" ? new ObjectId(userId) : userId },
        { $set: { att: att } }
      );
    }
  } catch (err: any) {
    console.error("Error fetching/updating attendance data:", err.message);
  }
};
