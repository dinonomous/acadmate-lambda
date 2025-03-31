import { MongoClient, ObjectId } from "mongodb";

const MONGO_URI = "mongodb://adminUser:AcadmateAdminTeam%401@98.130.23.168:27017/AcadmateUsers?authSource=admin";
const client = new MongoClient(MONGO_URI);
let isConnected = false;

export interface IUser {
  _id?: ObjectId;
  email: string;
  cookies?: string;
  att?: { user: any[]; attendance: any[]; marks: any[] };
  timetable?: any[];
  calendar?: Record<string, any>;
  do?: number;
  batch?: string;
  logs?: any[];
  lastUpdated?: Date;
  calendarLastUpdated?: Date;
}

export async function getUserCollection() {
  if (!isConnected) {
    await client.connect();
    isConnected = true;
    console.log("MongoDB Connected");
  } 
  return client.db("AcadmateUsers").collection<IUser>("users");
}
