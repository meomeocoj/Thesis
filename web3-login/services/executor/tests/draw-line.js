const { ChartJSNodeCanvas } = require("chartjs-node-canvas");
const fs = require("fs");

async function drawLineChart() {
  const { argv } = process;
  const path = argv[2];
  const destination = argv[3];
  const requestType = argv[4];
  if (!path) {
    throw new Error("path not found");
  }
  const data = JSON.parse(fs.readFileSync(path));
  const width = 1920; // Width of the chart canvas
  const height = 1080; // Height of the chart canvas
  const DPI = 300;

  // Prepare data for the chart
  const connections = data.results.map((result) => result.connections);
  const latency = data.results.map((result) => parseInt(result.latency.avg.split(" ")[0]));
  const throughput = data.results.map((result) => {
    const [num, unit] = result.throughput.avg.split(" ");
    if (unit === "MB") return num * 1024;
    return num;
  });

  const combinedConfig = {
    type: "line",
    data: {
      labels: connections.map(String),
      datasets: [
        {
          label: "Latency (ms)",
          data: latency,
          borderColor: "red",
          backgroundColor: "rgba(255, 0, 0, 0.2)", // Adding transparency to the background color for Latency
          fill: false,
          yAxisID: "y-axis-latency", // Assigning the dataset to the 'y-axis-latency'
        },
        {
          label: "Throughput",
          data: throughput,
          borderColor: "blue",
          backgroundColor: "rgba(0, 0, 255, 0.2)", // Adding transparency to the background color for Throughput
          fill: false,
          yAxisID: "y-axis-throughput", // Assigning the dataset to the 'y-axis-throughput'
        },
      ],
    },
    options: {
      responsive: false,
      scales: {
        y: {
          position: "left",
          grid: {
            drawOnChartArea: false,
          },
        },
        "y-axis-latency": {
          // New axis configuration for Latency
          type: "linear",
          position: "right", // Latency axis will appear on the right side
          grid: {
            drawOnChartArea: false,
          },
          title: {
            display: true,
            text: "Latency (ms)",
          },
        },
        "y-axis-throughput": {
          // New axis configuration for Throughput
          type: "linear",
          position: "left", // Throughput axis will appear on the left side
          grid: {
            drawOnChartArea: false,
          },
          title: {
            display: true,
            text: "Throughput (MB)",
          },
        },
      },
      title: {
        display: true,
        text: "Latency and Throughput Comparison for Different Connection Types",
      },
      legend: {
        display: true,
        position: "top",
        labels: {
          usePointStyle: true,
        },
      },
      elements: {
        point: {
          radius: 5,
          hoverRadius: 7,
        },
      },
    },
  };
  // Create a new ChartJSNodeCanvas instance
  const chartJSNodeCanvas = new ChartJSNodeCanvas({
    width,
    height,
    backgroundColour: "white",
    plugins: {
      dpi: DPI,
    },
  });

  // Render the chart to an image buffer
  const combinedBuffer = await chartJSNodeCanvas.renderToBuffer(combinedConfig);
  fs.writeFileSync(`${destination}/${requestType}-line-chart.png`, combinedBuffer);
}

drawLineChart();
