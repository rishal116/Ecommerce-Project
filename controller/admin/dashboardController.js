const Order = require('../../models/orderSchema')
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');





const filterOrder = async (req, res) => {

    try {
        let { startDate, endDate } = req.query;
        startDate = new Date(startDate);
        endDate = new Date(endDate);

        endDate.setHours(23, 59, 59, 999);

        const orders = await Order.find({
            createdOn: { $gte: startDate, $lte: endDate }
        });

        res.json(orders);

    } catch (error) {

        console.error("Error fetching orders:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
}

const downloadExcelReport = async (req, res) => {
  try {
    let { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: "Missing required date parameters" });
    }

    startDate = new Date(startDate);
    endDate = new Date(endDate);

    if (isNaN(startDate) || isNaN(endDate)) {
      return res.status(400).json({ error: "Invalid date format" });
    }

    endDate.setHours(23, 59, 59, 999); 

    const orders = await Order.find({
      createdOn: { $gte: startDate, $lte: endDate }
    }).populate('userId', 'name');

    const totalOrders = orders.length;
    const totalItems = orders.reduce((sum, order) => {
      const itemCount = order.orderItems ? 
        order.orderItems.reduce((itemSum, item) => itemSum + (item.quantity || 1), 0) : 0;
      return sum + itemCount;
    }, 0);
    const totalBaseAmount = orders.reduce((sum, order) => sum + (order.totalPrice || 0), 0);
    const totalDiscount = orders.reduce((sum, order) => {
      const discount = (order.totalPrice || 0) - (order.finalAmount || 0);
      return sum + (discount > 0 ? discount : 0);
    }, 0);
    const totalFinalAmount = orders.reduce((sum, order) => sum + (order.finalAmount || 0), 0);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Orders');

    worksheet.columns = [
      { header: 'Order ID', key: 'orderId', width: 30 },
      { header: 'User Name', key: 'userName', width: 25 },
      { header: 'Base Price', key: 'totalPrice', width: 15 },
      { header: 'Final Amount', key: 'finalAmount', width: 15 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Created On', key: 'createdOn', width: 15 }
    ];

    worksheet.getRow(1).font = { bold: true, size: 12 };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'F2F2F2' }
    };
    worksheet.getRow(1).border = {
      bottom: { style: 'thin', color: { argb: 'CCCCCC' } }
    };

    orders.forEach(order => {
      worksheet.addRow({
        orderId: order.orderId || order._id,
        userName: order.userId?.name || "Unknown",
        totalPrice: order.totalPrice || 0,
        finalAmount: order.finalAmount || 0,
        status: order.status,
        createdOn: order.createdOn.toISOString().split('T')[0]
      });
    });

    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: 6 }
    };

    worksheet.addRow({});
    worksheet.addRow({});

    const summaryTitleRow = worksheet.addRow(['Summary']);
    summaryTitleRow.font = { bold: true, size: 14 };
    summaryTitleRow.height = 25;

    const summaryData = [
      ['Total Orders', totalOrders],
      ['Total Items', totalItems],
      ['Total Base Amount', totalBaseAmount],
      ['Total Discount', totalDiscount],
      ['Total Final Amount', totalFinalAmount]
    ];

    summaryData.forEach(row => {
      const excelRow = worksheet.addRow(row);
      excelRow.getCell(1).font = { bold: true };
      if (typeof row[1] === 'number' && (row[0].includes('Amount') || row[0].includes('Discount'))) {
        excelRow.getCell(2).numFmt = '₹#,##0.00';
      }
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Orders_Report_${startDate.toISOString().split('T')[0]}_to_${endDate.toISOString().split('T')[0]}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Error generating Excel report:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};;


const downloadPdfReport = async (req, res) => {
  try {
    let { startDate, endDate } = req.query;
    startDate = new Date(startDate);
    endDate = new Date(endDate);
    endDate.setHours(23, 59, 59, 999);
    
    const orders = await Order.find({
      createdOn: { $gte: startDate, $lte: endDate }
    }).populate('userId', 'name');

    // Calculating summary details
    const totalOrders = orders.length;
    const totalItems = orders.reduce((sum, order) => {
      return sum + (order.orderItems ? order.orderItems.reduce((itemSum, item) => itemSum + (item.quantity || 1), 0) : 0);
    }, 0);
    const totalBaseAmount = orders.reduce((sum, order) => sum + (order.totalPrice || 0), 0);
    const totalDiscount = orders.reduce((sum, order) => sum + ((order.totalPrice || 0) - (order.finalAmount || 0)), 0);
    const totalFinalAmount = orders.reduce((sum, order) => sum + (order.finalAmount || 0), 0);

    const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=Orders-Report.pdf');
    doc.pipe(res);

    // Add "Trendy Threads" Title
    doc.font('Helvetica-Bold').fontSize(26).fillColor('#2563EB')
      .text("Trendy Threads", { align: 'center' });

    doc.moveDown(0.5);
    doc.fontSize(20).fillColor('#374151')
      .text("Orders Report", { align: 'center' });

    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).strokeColor('#E5E7EB').stroke();
    doc.moveDown(1);
    doc.font('Helvetica').fontSize(12).fillColor('#374151')
      .text(`Report Period: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`, { align: 'center' });
    doc.moveDown(1.5);

    // Table setup
    const startX = 50;
    const tableWidth = doc.page.width - 100;
    const columnWidths = [tableWidth * 0.3, tableWidth * 0.15, tableWidth * 0.15, tableWidth * 0.15, tableWidth * 0.25];

    const drawTableHeader = (y) => {
      doc.rect(startX, y, tableWidth, 25).fillColor('#F3F4F6').fill();
      doc.fillColor('#111827').font('Helvetica-Bold').fontSize(10);
      const headerY = y + 8;
      doc.text("USER NAME", startX + 10, headerY, { width: columnWidths[0] - 10 });
      doc.text("PRICE", startX + columnWidths[0] + 10, headerY, { width: columnWidths[1] - 10, align: 'right' });
      doc.text("AMOUNT", startX + columnWidths[0] + columnWidths[1] + 10, headerY, { width: columnWidths[2] - 10, align: 'right' });
      doc.text("STATUS", startX + columnWidths[0] + columnWidths[1] + columnWidths[2] + 10, headerY, { width: columnWidths[3] - 10, align: 'center' });
      doc.text("DATE", startX + columnWidths[0] + columnWidths[1] + columnWidths[2] + columnWidths[3] + 10, headerY, { width: columnWidths[4] - 10, align: 'center' });
      return y + 25;
    };

    let rowY = drawTableHeader(doc.y);
    doc.font('Helvetica').fontSize(10).fillColor('#4B5563');

    const checkAndAddPage = (height) => {
      if (rowY + height > doc.page.height - 100) {
        doc.addPage();
        doc.font('Helvetica-Bold').fontSize(14).fillColor('#2563EB')
          .text("Trendy Threads - Orders Report (Continued)", 50, 50, { align: 'center' });
        doc.moveDown(1);
        rowY = drawTableHeader(doc.y);
      }
      return rowY;
    };

    const statusColors = {
      'Completed': '#10B981',  
      'Pending': '#F59E0B',   
      'Cancelled': '#EF4444', 
      'Processing': '#3B82F6',
      'Shipped': '#6366F1',  
      'Delivered': '#22C55E',
      'Return Request': '#D97706',
      'Return Accepted': '#10B981',
      'Return Rejected': '#EF4444',
      'payment pending': '#E11D48'
    };

    orders.forEach((order, index) => {
      rowY = checkAndAddPage(30);
      if (index % 2 === 0) {
        doc.rect(startX, rowY, tableWidth, 30).fillColor('#F9FAFB').fill();
      }

      const userName = order.userId?.name || "Unknown";
      const rowTextY = rowY + 10;
      doc.fillColor('#4B5563');
      doc.text(userName, startX + 10, rowTextY, { width: columnWidths[0] - 10 });
      doc.text(`₹${(order.totalPrice || 0).toFixed(2)}`, startX + columnWidths[0] + 10, rowTextY, { width: columnWidths[1] - 10, align: 'right' });
      doc.text(`₹${(order.finalAmount || 0).toFixed(2)}`, startX + columnWidths[0] + columnWidths[1] + 10, rowTextY, { width: columnWidths[2] - 10, align: 'right' });

      const statusColor = statusColors[order.status] || '#4B5563';
      doc.fillColor(statusColor);
      doc.text(order.status, startX + columnWidths[0] + columnWidths[1] + columnWidths[2] + 10, rowTextY, { width: columnWidths[3] - 10, align: 'center' });
      doc.fillColor('#4B5563');
      doc.text(new Date(order.createdOn).toLocaleDateString(), startX + columnWidths[0] + columnWidths[1] + columnWidths[2] + columnWidths[3] + 10, rowTextY, { width: columnWidths[4] - 10, align: 'center' });

      rowY += 30;
    });

   // Draw summary box
   const boxX = 50;
   const boxY = rowY + 20;
   const boxWidth = doc.page.width - 100;
   const boxHeight = 140;

   doc.rect(boxX, boxY, boxWidth, boxHeight).strokeColor('#374151').lineWidth(1).stroke();

   doc.font('Helvetica-Bold').fontSize(14).fillColor('#111827')
     .text("Summary", boxX + 10, boxY + 10);

   doc.font('Helvetica').fontSize(12).fillColor('#4B5563')
     .text(`Total Orders: ${totalOrders}`, boxX + 10, boxY + 35)
     .text(`Total Items: ${totalItems}`, boxX + 10, boxY + 55)
     .text(`Total Base Amount: ₹${totalBaseAmount.toFixed(2)}`, boxX + 10, boxY + 75)
     .text(`Total Discount: ₹${totalDiscount.toFixed(2)}`, boxX + 10, boxY + 94)
     .text(`Total Final Amount: ₹${totalFinalAmount.toFixed(2)}`, boxX + 10, boxY + 109);


    doc.end();
  } catch (error) {
    console.error("Error generating PDF report:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};


module.exports = {
    filterOrder,
    downloadExcelReport,
    downloadPdfReport
}