# **App Name**: ImmoSales Insight

## Core Features:

- Sales Data Management: Store and manage real estate sales records within a dedicated 'vendas_imoveis' collection in Firebase Firestore, including details like property ID, dates, origin, client, broker, and sales values. Documents directly mirror provided fields.
- Real-time Sales Metrics: Automatically calculate and display key performance indicators such as 'Tempo de Venda' (time to sale), 'Ticket Médio' (average value per broker/month), and 'Performance por Canal' (sales grouped by origin).
- Interactive Sales Dashboard: Present a dashboard consolidating sales data. It features a month/year filter and a performance table displaying total sales and accumulated value for each 'corretor', similar to the original 'Base' spreadsheet tab.
- CSV Data Importer: Utilize a Node.js script to efficiently convert and batch upload historical sales data from a CSV file into the Firestore 'vendas_imoveis' collection, ensuring correct data type mapping for dates and numbers.
- AI-powered Sales Performance Tool: Generate brief, insightful summaries of sales performance for selected periods or brokers. This tool identifies key trends, highlights top performers, and suggests areas for strategic focus.

## Style Guidelines:

- Primary color: A deep, professional blue (#2E9EC0), chosen to evoke trust and stability, aligning with real estate professionalism. It provides a solid foundation for data presentation.
- Background color: A very light, desaturated blue-gray (#F0F2F4), providing a clean and unobtrusive canvas for information, ensuring data stands out.
- Accent color: A vibrant aqua (#30E9E9), chosen to add a dynamic touch to interactive elements and highlight key metrics, creating good visual contrast with the primary blue.
- Body and headline font: 'Inter', a modern sans-serif. Its objective and clean aesthetic is ideal for presenting data clearly and efficiently on a dashboard.
- Use a set of clean, line-based icons for clarity and professionalism, consistently applied throughout the dashboard to guide user interaction and enhance data readability.
- Employ a responsive, modular layout for the dashboard, prioritizing clear data visualization. Filters will be prominently placed, and performance tables will feature easy-to-digest data rows.
- Incorporate subtle animations for state changes, such as filtering data or loading new reports, to provide a smooth and feedback-rich user experience without distraction.