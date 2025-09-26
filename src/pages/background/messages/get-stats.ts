import { databaseService } from "database/service";

interface GetStatsResponse {
  success: boolean;
  stats?: any;
  error?: string;
}

export async function handleGetStats(req: any, sender: any) {
  try {
    const stats = await databaseService.getStats();
    console.log("✅ Stats retrieved:", stats);

    return {
      success: true,
      stats,
    };
  } catch (error: any) {
    console.error("❌ Error getting stats:", error);
    return {
      success: false,
      error: error.message || "Failed to get stats",
    };
  }
}
