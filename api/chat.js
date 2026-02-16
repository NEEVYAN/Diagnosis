export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { message, adminUid, company } = req.body;

  if (!message) {
    return res.status(400).json({ error: "Message missing" });
  }

  try {

    // 🔥 Ask AI for intent classification
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

If OTP request:
{"intent":"send_otp","phone":"xxxxxxxxxx"}

If asking for property details:
{"intent":"property_detail","propertyName":"name"}

If asking number of properties:
{"intent":"property_count"}

If asking to list properties:
{"intent":"property_list"}

If asking to filter properties:
{"intent":"property_filter","propertyType":"PG","propertyLocation":"Noida"}

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
    const parsed = JSON.parse(aiData.choices?.[0]?.message?.content || "{}");

    // ================================
    // 🔥 OTP
    // ================================
    if (parsed.intent === "send_otp") {

      if (!parsed.phone || !/^[0-9]{10}$/.test(parsed.phone)) {
        return res.status(200).json({ reply: "Invalid phone number." });
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

      return res.status(200).json({
        reply: otpResult.status === "success"
          ? "OTP sent successfully"
          : "Failed to send OTP"
      });
    }

    // ================================
    // 🔥 PROPERTY COUNT
    // ================================
    if (parsed.intent === "property_count") {

      const response = await fetch(
        `https://api.stazy.live/PropertyDetails.php?action=count&adminUid=${adminUid}&company=${company}`
      );

      const data = await response.json();

      return res.status(200).json({
        reply: `You have ${data.totalProperties} properties.`
      });
    }

    // ================================
    // 🔥 PROPERTY LIST
    // ================================
    if (parsed.intent === "property_list") {

      const response = await fetch(
        `https://api.stazy.live/PropertyDetails.php?action=list&adminUid=${adminUid}&company=${company}`
      );

      const data = await response.json();

      return res.status(200).json({
        reply: `Your properties are: ${data.propertyNames.join(", ")}`
      });
    }

    // ================================
    // 🔥 PROPERTY DETAIL
    // ================================
    if (parsed.intent === "property_detail") {

      const response = await fetch(
        `https://api.stazy.live/PropertyDetails.php?action=detail&adminUid=${adminUid}&company=${company}&propertyId=${parsed.propertyName}`
      );

      const data = await response.json();

      if (!data.success) {
        return res.status(200).json({
          reply: "Property not found."
        });
      }

      const p = data.data.propertyData;

      return res.status(200).json({
        reply: `
Property Name: ${p.propertyName}
Location: ${p.propertyLocation}
Type: ${p.propertyType}
Rent: ₹${p.rent}
Food: ${p.FoodAvail}
Rooms: ${p.numberOfRooms}
        `
      });
    }

    // ================================
    // 🔥 NORMAL CHAT
    // ================================
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
