import { NextRequest, NextResponse } from "next/server";
import { getReportById } from "@/lib/db";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { reportId } = body;

  if (!reportId) {
    return NextResponse.json({ error: "缺少 reportId" }, { status: 400 });
  }

  const report = getReportById(Number(reportId));
  if (!report) {
    return NextResponse.json({ error: "周报不存在" }, { status: 404 });
  }

  const token = process.env.DINGTALK_WEBHOOK_4_AGENT_NOTIFY;
  if (!token) {
    return NextResponse.json({ error: "未配置钉钉 Webhook 环境变量 DINGTALK_WEBHOOK_4_AGENT_NOTIFY" }, { status: 500 });
  }

  // Token only — build full webhook URL
  const webhookUrl = token.startsWith("http")
    ? token
    : `https://oapi.dingtalk.com/robot/send?access_token=${token}`;

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}月${d.getDate()}日`;
  };

  const title = `周报 (${formatDate(report.week_start)} ~ ${formatDate(report.week_end)})`;
  // Put "周报" at the very start to ensure keyword match for DingTalk
  const text = `【周报】${formatDate(report.week_start)} ~ ${formatDate(report.week_end)}\n\n${report.content}`;

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        msgtype: "markdown",
        markdown: {
          title,
          text: text.slice(0, 18000),
        },
      }),
    });

    const data = await res.json();
    if (data.errcode !== 0) {
      console.error("DingTalk API error:", data);
      return NextResponse.json({ error: `钉钉返回错误: ${data.errmsg}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, title });
  } catch (error) {
    console.error("Failed to send DingTalk notification:", error);
    return NextResponse.json(
      { error: "发送失败，请检查钉钉 Webhook 配置" },
      { status: 500 }
    );
  }
}
