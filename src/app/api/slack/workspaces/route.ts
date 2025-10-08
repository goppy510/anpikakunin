import { NextResponse } from "next/server";
import {
  listSlackWorkspaces,
  upsertSlackWorkspaceWithSettings,
  type SlackWorkspaceInput,
  type SlackNotificationSettingsInput,
} from "@/app/lib/db/slackSettings";

type PostRequestBody = {
  workspace: SlackWorkspaceInput;
  settings?: SlackNotificationSettingsInput;
};

export async function GET() {
  try {
    const workspaces = await listSlackWorkspaces();
    return NextResponse.json({ items: workspaces });
  } catch (error) {
    console.error("Failed to fetch Slack workspaces:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PostRequestBody;

    if (!body?.workspace) {
      return NextResponse.json(
        { error: "workspace payload is required" },
        { status: 400 }
      );
    }

    const { workspace, settings } = body;

    if (!workspace.workspaceId || !workspace.name || !workspace.botToken) {
      return NextResponse.json(
        {
          error:
            "workspaceId, name, and botToken are required in workspace payload",
        },
        { status: 400 }
      );
    }

    if (
      settings &&
      settings.workspaceId &&
      settings.workspaceId !== workspace.workspaceId
    ) {
      return NextResponse.json(
        { error: "settings.workspaceId must match workspace.workspaceId" },
        { status: 400 }
      );
    }

    const saved = await upsertSlackWorkspaceWithSettings(workspace, settings);
    return NextResponse.json(saved, { status: 201 });
  } catch (error) {
    console.error("Failed to upsert Slack workspace:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
