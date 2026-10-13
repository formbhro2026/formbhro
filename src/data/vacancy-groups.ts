/**
 * Shared definitions, options, and filter helpers for Formbhro Job Update Groups.
 */

export const JOB_GROUPS = [
  {
    id: "jobs-update",
    name: "Jobs Update",
    category: "Jobs Update",
    badge: "Official",
    tagline: "Verified Central & State Government Recruitment Notifications",
    description:
      "All verified government forms, UPSC, SSC, Railways, Banking, Defense, and State PSC notifications updated daily.",
  },
  {
    id: "hidden-jobs-update",
    name: "Hidden Jobs Update",
    category: "Hidden Jobs Update",
    badge: "Exclusive",
    tagline: "Special Openings, Direct Recruitments & Off-Campus Drives",
    description:
      "Exclusive hidden opportunities, PSU contract recruitments, direct walk-ins, off-campus tech drives, and private vacancies.",
  },
] as const;

export type JobGroupId = (typeof JOB_GROUPS)[number]["id"];

export const DEFAULT_QUALIFICATIONS = [
  "10th Pass",
  "12th Pass",
  "ITI / Diploma",
  "Graduation",
  "Post-Graduation",
  "B.Tech / BE",
  "Any Qualification",
] as const;

export const VACANCY_STATUS_OPTIONS = [
  { id: "live", label: "Live Now / Open", tone: "green" },
  { id: "closed", label: "Closed", tone: "red" },
] as const;

export interface VacancyFilterState {
  group: string;
  search: string;
  qualification: string;
  status: string; // 'all' | 'live' | 'closed'
  userAge: string;
  sortBy: "newest" | "deadline" | "vacancies";
}

export function isVacancyLive(item: {
  vacancy_status?: string | null;
  application_last_date?: string | null;
}): boolean {
  if (item.vacancy_status === "closed" || item.vacancy_status === "expired") return false;
  if (item.application_last_date) {
    const end = new Date(item.application_last_date);
    if (!isNaN(end.getTime())) {
      end.setHours(23, 59, 59, 999);
      if (end.getTime() < Date.now()) return false;
    }
  }
  return true;
}

export function matchesAgeCriteria(
  userAgeStr: string,
  minAge?: number | null,
  maxAge?: number | null,
): boolean {
  if (!userAgeStr.trim()) return true;
  const age = parseInt(userAgeStr, 10);
  if (isNaN(age)) return true;
  if (minAge != null && age < minAge) return false;
  if (maxAge != null && age > maxAge) return false;
  return true;
}
