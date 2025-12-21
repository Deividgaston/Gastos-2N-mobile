function formatEuro(v: number) {
  return (v || 0).toFixed(2).replace('.', ',') + ' €';
}
function formatKm(v: number) {
  return (v || 0).toFixed(1).replace('.', ',') + ' km';
}

const buildPdf = async () => {
  const monthValue = month || '';

  const w: any = window as any;
  if (!w.jspdf || !w.jspdf.jsPDF) {
    alert('jsPDF no está disponible. Revisa index.html.');
    return;
  }

  const { jsPDF } = w.jspdf;
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text('2N Expenses - Monthly Summary', 14, 16);
  doc.setFontSize(11);
  doc.text('Month: ' + (monthValue || 'N/A'), 14, 24);

  // Totales (mismo cálculo que tu UI)
  let totG = 0;
  let totPersonalPaid = 0;
  entries.forEach((e: any) => {
    const amount = Number(e.amount || 0);
    totG += amount;
    if ((e.paidWith || '').toLowerCase() === 'personal') totPersonalPaid += amount;
  });

  let kmEmp = 0, kmPer = 0, costPer = 0;
  kms.forEach((k: any) => {
    const km = Number(k.km || k.distance || 0) || 0;
    const fuel = (k.fuelPrice != null && k.fuelPrice !== '') ? Number(k.fuelPrice) : NaN;

    if ((k.type || '').toLowerCase().includes('per')) {
      kmPer += km;
      if (!isNaN(fuel) && fuel > 0) costPer += km * fuel * 6 / 100;
    } else {
      kmEmp += km;
    }
  });

  const owed = totPersonalPaid - costPer;

  doc.setDrawColor(200);
  doc.setLineWidth(0.3);

  // Summary boxes
  doc.roundedRect(12, 30, 90, 32, 3, 3);
  doc.setFontSize(11);
  doc.text('Expenses summary', 16, 36);
  doc.setFontSize(10);
  doc.text('Total expenses: ' + formatEuro(totG), 16, 44);
  doc.text('Paid with my money: ' + formatEuro(totPersonalPaid), 16, 50);
  doc.text('Company owes me: ' + formatEuro(owed), 16, 56);

  doc.roundedRect(110, 30, 88, 32, 3, 3);
  doc.setFontSize(11);
  doc.text('Mileage summary', 114, 36);
  doc.setFontSize(10);
  doc.text('Company mileage: ' + formatKm(kmEmp), 114, 44);
  doc.text('Personal mileage: ' + formatKm(kmPer), 114, 50);
  doc.text('Personal mileage cost (km × €/L × 6L/100km): ' + formatEuro(costPer), 114, 56);

  // Expenses table
  const rows = entries.map((e: any) => {
    const d = e.dateJs instanceof Date ? e.dateJs.toISOString().slice(0, 10) : (e.date || '');
    return [
      d,
      e.provider || '',
      e.category || '',
      (e.paidWith || ''),
      (e.notes || '').toString().slice(0, 40),
      (Number(e.amount || 0)).toFixed(2),
    ];
  });

  (doc as any).autoTable({
    startY: 66,
    head: [['Date','Provider','Category','Paid with','Notes','Amount']],
    body: rows,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [0,0,0] }
  });

  // Mileage table
  const finalY = (doc as any).lastAutoTable?.finalY || 66;

  const rowsKm = kms.map((k: any) => {
    const d = k.dateJs instanceof Date ? k.dateJs.toISOString().slice(0, 10) : (k.date || '');
    const km = Number(k.km || k.distance || 0) || 0;
    const fuel = (k.fuelPrice != null && k.fuelPrice !== '') ? Number(k.fuelPrice) : NaN;

    const type = (k.type || '').toLowerCase().includes('per') ? 'Personal' : 'Company';
    let costPers = 0;
    if (type === 'Personal' && !isNaN(fuel) && fuel > 0) costPers = km * fuel * 6 / 100;

    return [
      d,
      type,
      km.toFixed(1),
      (!isNaN(fuel) && fuel > 0) ? fuel.toFixed(2) : '',
      costPers ? costPers.toFixed(2) : '',
      (k.notes || '').toString().slice(0, 60)
    ];
  });

  (doc as any).autoTable({
    startY: finalY + 6,
    head: [['Date','Type','KM','€/L','Personal cost','Notes']],
    body: rowsKm,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [30,30,30] }
  });

  doc.save('monthly-summary-2n-' + (monthValue || 'month') + '.pdf');
};
