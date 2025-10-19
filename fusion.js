async function loadFusionData() {
  try {
    const res = await fetch("/data/fused_knowledge.json");
    if (!res.ok) {
      throw new Error(`Request failed with status ${res.status}`);
    }
    const data = await res.json();
    render(data);
  } catch (err) {
    console.error("Unable to load fusion data", err);
    const target = document.getElementById("fusionData");
    target.textContent = "Unable to load fusion data. Check the server logs for details.";
  }
}

function render(data) {
  const ctx = document.getElementById("fusionPie").getContext("2d");
  new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Skills", "Dialogues", "Outcomes"],
      datasets: [{
        data: [
          Object.keys(data.skills || {}).length,
          Object.keys(data.dialogues || {}).length,
          (data.outcomes || []).length
        ],
        backgroundColor: ["#60a5fa", "#34d399", "#f87171"],
        borderWidth: 2,
        borderColor: "rgba(15, 23, 42, 0.85)",
        hoverOffset: 10
      }]
    },
    options: { plugins: { legend: { position: "bottom" } } }
  });

  document.getElementById("fusionData").textContent = JSON.stringify(data, null, 2);

  const skills = Object.keys(data.skills || {}).length;
  const dialogues = Object.keys(data.dialogues || {}).length;
  const outcomes = (data.outcomes || []).length;
  const lastSync = data.lastSync || "N/A";

  const map = [
    ["fusion-skills", skills],
    ["fusion-dialogues", dialogues],
    ["fusion-outcomes", outcomes],
    ["fusion-last", lastSync],
    ["fusion-skills-detail", skills],
    ["fusion-dialogues-detail", dialogues],
    ["fusion-outcomes-detail", outcomes],
    ["fusion-last-detail", lastSync]
  ];

  map.forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = value;
    }
  });
}

loadFusionData();
