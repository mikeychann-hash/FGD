async function loadFusionData() {
  const res = await fetch("/data/fused_knowledge.json");
  const data = await res.json();
  render(data);
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
          data.outcomes?.length || 0
        ],
        backgroundColor: ["#58a6ff", "#3fb950", "#f85149"]
      }]
    },
    options: { plugins: { legend: { position: "bottom" } } }
  });
  document.getElementById("fusionData").textContent = JSON.stringify(data, null, 2);
}
loadFusionData();