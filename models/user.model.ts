import mongoose, { Document, Schema } from "mongoose";

export interface IUser extends Document {
  email: string;
  cookies?: string;
  att?: Record<string, any>;
  timetable?: any[];
  calendar?: Record<string, any>;
  do?: number;
  batch?: string;
  logs?: any[];
  lastUpdated?: Date;
  calendarLastUpdated?: Date;
}

const userSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, trim: true, unique: true, index: true }, 
    cookies: { type: String, default: "" },
    att: { type: Object, required: false, default: {} },
    timetable: { type: Array, required: false, default: [] },
    calendar: { type: Object, default: {} },
    do: { type: Number, default: 0 },
    batch: { type: String, default: "", index: true },
    logs: { type: Array, default: [] },
    lastUpdated: { type: Date, default: Date.now, index: true },
    calendarLastUpdated: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>("User", userSchema);
