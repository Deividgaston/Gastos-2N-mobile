export type Language = 'ES' | 'EN' | 'PT';

export const translations = {
    ES: {
        nav: { expenses: 'Gastos', mileage: 'Kilometraje', summary: 'Resumen', export: 'Exportar', login: 'Entrar', logout: 'Salir' },
        home: {
            scan: 'Escanear Ticket', scanDesc: 'Gemini OCR Vision',
            manual: 'Ingreso Manual', manualDesc: 'Formulario rápido',
            recent: 'Notas recientes', last5: 'Últimos 5', empty: 'Sin apuntes aún.',
            modalTitle: 'Revisar registro', processing: 'Procesando ticket...', iaWarning: 'IA de Gemini analizando datos',
            date: 'Fecha de gasto', amount: 'Importe Total (€)', provider: 'Establecimiento / Proveedor',
            category: 'Categoría', payment: 'Método de pago', notes: 'Observaciones', redo: 'Rehacer foto', save: 'Guardar gasto'
        },
        mileage: {
            title: 'Registro de Kilometraje', desc: 'Gestiona tus traslados y consumos del mes.',
            formTitle: 'Nuevo Trayecto', statsTitle: 'Resumen de Trayectos',
            consumption: 'Consumo (l/100km)', fuel: 'Precio Combustible (€/L)', distance: 'Distancia (km)',
            type: 'Tipo de Trayecto', company: 'Empresa', personal: 'Personal',
            odometer: 'Odómetro Proyectado', current: 'Actual', projected: 'Tras viaje',
            save: 'Guardar Registro', history: 'Historial Mensual', empty: 'Sin KM registrados.'
        },
        summary: {
            title: 'Resumen mensual', reimbursement: 'Liquidación estimada', toReimburse: 'A reembolsar',
            fromPocket: 'Pagado de mi bolsillo', deductKm: 'Deducir KM', basedOn: 'Basado en pagos personales menos coste de KM personales.',
            totalExpenses: 'Total Gastos', paidByMe: 'Pagado por mi', kmCompany: 'KM Empresa', kmPersonal: 'KM Personal',
            pdf: 'Descargar PDF', excel: 'Exportar Excel', zip: 'Tickets (ZIP)',
            details: 'Detalle del Periodo', preview: 'Vista Previa', noImage: 'Sin documento adjunto',
            edit: 'Editar Registro', delete: 'Eliminar', update: 'Actualizar'
        }
    },
    EN: {
        nav: { expenses: 'Expenses', mileage: 'Mileage', summary: 'Summary', export: 'Export', login: 'Login', logout: 'Logout' },
        home: {
            scan: 'Scan Receipt', scanDesc: 'Gemini OCR Vision',
            manual: 'Manual Entry', manualDesc: 'Quick form',
            recent: 'Recent Notes', last5: 'Last 5', empty: 'No notes yet.',
            modalTitle: 'Review Entry', processing: 'Processing receipt...', iaWarning: 'Gemini AI analyzing data',
            date: 'Expense Date', amount: 'Total Amount (€)', provider: 'Establishment / Provider',
            category: 'Category', payment: 'Payment Method', notes: 'Notes', redo: 'Retake Photo', save: 'Save Expense'
        },
        mileage: {
            title: 'Mileage Records', desc: 'Manage your trips and consumption for the month.',
            formTitle: 'New Trip', statsTitle: 'Trip Summary',
            consumption: 'Consumption (l/100km)', fuel: 'Fuel Price (€/L)', distance: 'Distance (km)',
            type: 'Trip Type', company: 'Company', personal: 'Personal',
            odometer: 'Projected Odometer', current: 'Current', projected: 'After trip',
            save: 'Save Record', history: 'Monthly History', empty: 'No KM recorded.'
        },
        summary: {
            title: 'Monthly Summary', reimbursement: 'Estimated Settlement', toReimburse: 'To Reinvest',
            fromPocket: 'Paid from pocket', deductKm: 'Deduct KM', basedOn: 'Based on personal payments minus personal KM costs.',
            totalExpenses: 'Total Expenses', paidByMe: 'Paid by me', kmCompany: 'Company KM', kmPersonal: 'Personal KM',
            pdf: 'Download PDF', excel: 'Export Excel', zip: 'Receipts (ZIP)',
            details: 'Period Details', preview: 'Preview', noImage: 'No document attached',
            edit: 'Edit Entry', delete: 'Delete', update: 'Update'
        }
    },
    PT: {
        nav: { expenses: 'Gastos', mileage: 'Quilometragem', summary: 'Resumo', export: 'Exportar', login: 'Entrar', logout: 'Sair' },
        home: {
            scan: 'Digitalizar Recibo', scanDesc: 'Gemini OCR Vision',
            manual: 'Entrada Manual', manualDesc: 'Formulário rápido',
            recent: 'Notas recentes', last5: 'Últimos 5', empty: 'Sem notas ainda.',
            modalTitle: 'Revisar registro', processing: 'Processando recibo...', iaWarning: 'Gemini AI analisando dados',
            date: 'Data da despesa', amount: 'Valor Total (€)', provider: 'Estabelecimento / Fornecedor',
            category: 'Categoria', payment: 'Método de pagamento', notes: 'Observações', redo: 'Refazer foto', save: 'Salvar despesa'
        },
        mileage: {
            title: 'Registos de KM', desc: 'Gerencie suas viagens e consumos do mês.',
            formTitle: 'Nova Viagem', statsTitle: 'Resumo de Viagens',
            consumption: 'Consumo (l/100km)', fuel: 'Preço Combustível (€/L)', distance: 'Distância (km)',
            type: 'Tipo de Viagem', company: 'Empresa', personal: 'Pessoal',
            odometer: 'Odómetro Projetado', current: 'Atual', projected: 'Após viagem',
            save: 'Salvar Registo', history: 'Histórico Mensal', empty: 'Sem KM registados.'
        },
        summary: {
            title: 'Resumo mensal', reimbursement: 'Liquidação estimada', toReimburse: 'A reembolsar',
            fromPocket: 'Pago do meu bolso', deductKm: 'Deduzir KM', basedOn: 'Baseado em pagamentos pessoais menos custos de KM pessoais.',
            totalExpenses: 'Total Gastos', paidByMe: 'Pago por mim', kmCompany: 'KM Empresa', kmPersonal: 'KM Pessoal',
            pdf: 'Baixar PDF', excel: 'Exportar Excel', zip: 'Tickets (ZIP)',
            details: 'Detalhe do Período', preview: 'Visualização', noImage: 'Sem documento anexo',
            edit: 'Editar Registo', delete: 'Eliminar', update: 'Atualizar'
        }
    }
};
