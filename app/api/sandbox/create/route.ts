import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createSandbox } from "@/lib/e2b";

export async function POST() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sandbox, info } = await createSandbox();

    return NextResponse.json({
      sandboxId: info.id,
      status: info.status,
    });
  } catch (error) {
    console.error("Error creating sandbox:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create sandbox" },
      { status: 500 }
    );
  }
}
