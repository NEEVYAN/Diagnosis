export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: "Message missing" });
  }

  try {

    const aiResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          {
            role: "system",
            content: `
You are Shft-In AI Assistant made by Neeraj.

You must ALWAYS respond in valid JSON.

FORMAT:

If OTP request:
{"intent":"send_otp","phone":"xxxxxxxxxx"}

If phone missing:
{"intent":"send_otp","phone":null}

If normal:
{"intent":"normal","reply":"full reply here"}

DO NOT WRITE ANYTHING ELSE.
`
          },
          { role: "user", content: message }
        ]
      })
    });

    const aiData = await aiResponse.json();
    const aiReply = aiData.choices?.[0]?.message?.content?.trim() || "";

    let parsed;
    try {
      parsed = JSON.parse(aiReply);
    } catch {
      return res.status(500).json({ reply: "AI response parsing failed" });
    }

    // 🔥 OTP INTENT
    if (parsed.intent === "send_otp") {

      if (!parsed.phone) {
        return res.status(200).json({
          reply: "Please provide a valid phone number."
        });
      }

      if (!/^[0-9]{10}$/.test(parsed.phone)) {
        return res.status(200).json({
          reply: "Invalid phone number format."
        });
      }

      const otpResponse = await fetch("https://sms.stazy.live/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: parsed.phone,
          action: "send_otp"
        })
      });

      const otpResult = await otpResponse.json();

      if (otpResult.status === "success") {
        return res.status(200).json({
          reply: "OTP sent successfully"
        });
      } else {
        return res.status(500).json({
          reply: "Failed to send OTP"
        });
      }
    }

    // 🧠 NORMAL INTENT
    if (parsed.intent === "normal") {
      return res.status(200).json({
        reply: parsed.reply
      });
    }

    return res.status(500).json({ reply: "Unknown intent" });

  } catch (error) {
    return res.status(500).json({ error: "Server error" });
  }
}
