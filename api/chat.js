export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: "Message missing" });
  }

  try {

    // 🔥 Ask AI to classify intent
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
You are Shft-In AI Assistant.

If user wants OTP or verification code, reply ONLY in JSON:
{
  "intent": "send_otp",
  "phone": "xxxxxxxxxx"
}

If phone missing:
{
  "intent": "send_otp",
  "phone": null
}

Otherwise reply normally.
`
          },
          { role: "user", content: message }
        ]
      })
    });

    const aiData = await aiResponse.json();
    const aiReply = aiData.choices?.[0]?.message?.content || "";

    let parsed;
    try {
      parsed = JSON.parse(aiReply);
    } catch {
      parsed = null;
    }

    // 🔥 If AI detected OTP intent
    if (parsed?.intent === "send_otp") {

      // If phone missing
      if (!parsed.phone) {
        return res.status(200).json({
          reply: "Please provide a valid phone number."
        });
      }

      // Validate phone
      if (!/^[0-9]{10}$/.test(parsed.phone)) {
        return res.status(200).json({
          reply: "Invalid phone number format."
        });
      }

      // 🔥 Call your backend
      const otpResponse = await fetch("https://sms.stazy.live/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
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

    // 🧠 Normal conversation
    return res.status(200).json({
      reply: aiReply
    });

  } catch (error) {
    return res.status(500).json({ error: "Server error" });
  }
}
