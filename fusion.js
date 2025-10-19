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
        backgroundColor: ["#58a6ff", "#3fb950", "#f85149"]
      }]
    },
    options: { plugins: { legend: { position: "bottom" } } }
  });

  document.getElementById("fusionData").textContent = JSON.stringify(data, null, 2);
}

loadFusionData();
