import { ChevronDown, ChevronRight, Receipt, Plus, CheckCircle, Trash2, XCircle, History } from 'lucide-react';
import { formatMoney } from '../../data/mockData';
import { daysDiff } from '../../utils/date';
import StatusBadge from '../../components/ui/StatusBadge';
import InvoiceBadge from './InvoiceBadge';

export default function OrderRow({ order, invoice, voidedInvoices = [], isExpanded, onToggle, onCreateInvoice, onAddPayment, onDeletePayment, onDeactivate, calcPenalty }) {
  const remaining = invoice ? Math.max(0, invoice.amount - invoice.paidAmount) : 0;
  const overdue = invoice?.status === 'overdue';
  const hasHistory = voidedInvoices.length > 0;

  return (
    <>
      <tr
        className={`border-b border-gray-100 transition-colors ${(invoice || hasHistory) ? 'cursor-pointer' : ''} ${isExpanded ? 'bg-indigo-50/40' : 'hover:bg-gray-100/60'}`}
        onClick={onToggle}
      >
        <td className="pl-10 pr-3 py-3">
          <div className="flex items-center gap-2">
            {(invoice || hasHistory)
              ? isExpanded
                ? <ChevronDown size={14} className="text-indigo-400 flex-shrink-0" />
                : <ChevronRight size={14} className="text-gray-400 flex-shrink-0" />
              : <span className="inline-block w-3.5" />}
            <div>
              <div className="font-medium text-gray-900 whitespace-nowrap">{order.number}</div>
              <div className="text-xs text-gray-400 whitespace-nowrap">от {order.date}</div>
            </div>
          </div>
        </td>

        <td className="px-4 py-3 whitespace-nowrap"><StatusBadge status={order.status} /></td>

        <td className="px-4 py-3 font-semibold text-gray-800 whitespace-nowrap">
          {formatMoney(order.totalAmount || order.total_amount || 0)}
        </td>

        <td className="px-4 py-3 whitespace-nowrap">
          {invoice
            ? <div className="flex items-center gap-1.5 text-gray-700">
                <Receipt size={13} className="text-gray-400" />
                <span className="font-medium">{invoice.invoiceNumber}</span>
                {hasHistory && (
                  <span className="inline-flex items-center gap-0.5 text-xs text-gray-400" title={`${voidedInvoices.length} аннулированных счёта`}>
                    <History size={11} /> {voidedInvoices.length}
                  </span>
                )}
              </div>
            : <div className="flex items-center gap-2">
                <button
                  className="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 font-medium"
                  onClick={e => { e.stopPropagation(); onCreateInvoice(); }}
                >
                  <Plus size={13} /> {hasHistory ? 'Выставить новый' : 'Создать счёт'}
                </button>
              </div>}
        </td>

        <td className="px-4 py-3 whitespace-nowrap">
          {invoice ? (
            <div className="text-xs space-y-0.5">
              <div className="text-green-700 font-medium">{formatMoney(invoice.paidAmount)}</div>
              {remaining > 0 && <div className={`${overdue ? 'text-red-500' : 'text-orange-500'} font-medium`}>−{formatMoney(remaining)}</div>}
            </div>
          ) : <span className="text-gray-300">—</span>}
        </td>

        <td className="px-4 py-3 whitespace-nowrap">
          {invoice ? <InvoiceBadge status={invoice.status} /> : <span className="text-gray-300 text-xs">Нет счёта</span>}
        </td>

        <td className="px-4 py-3 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
          {invoice && invoice.status !== 'paid' && (
            <div className="flex items-center justify-end gap-2">
              <button className="btn-secondary text-xs py-1 px-2" onClick={() => onAddPayment(invoice)}>
                + Оплата
              </button>
              <button
                className="text-gray-400 hover:text-red-500 transition-colors"
                title="Аннулировать счёт и выставить новый"
                onClick={() => onDeactivate(invoice)}
              >
                <XCircle size={15} />
              </button>
            </div>
          )}
        </td>
      </tr>

      {isExpanded && invoice && (
        <>
          <tr className="bg-indigo-50/30 border-b border-indigo-100/50">
            <td className="pl-14 pr-3 py-2 text-xs text-gray-500" colSpan={3}>
              {invoice.invoiceDate && (
                <span className="mr-4">
                  <span className="font-medium text-gray-700">Дата счёта:</span>{' '}
                  <span className="text-gray-700">{invoice.invoiceDate}</span>
                </span>
              )}
              <span className="font-medium text-gray-700">Срок оплаты:</span>{' '}
              <span className={overdue ? 'text-red-600 font-medium' : 'text-gray-700'}>
                {invoice.dueDate || '—'}
                {overdue && ` (просрочено ${daysDiff(invoice.dueDate)} дн.)`}
              </span>
              {overdue && (
                <span className="ml-3 text-red-500 font-medium">
                  Штраф ≈ {formatMoney(calcPenalty(invoice))}
                </span>
              )}
            </td>
            <td colSpan={4} />
          </tr>

          {invoice.installments?.length > 0 ? invoice.installments.map(inst => (
            <tr key={`inst-${inst.id}`} className="border-b border-gray-100 text-xs bg-indigo-50/20">
              <td className="pl-14 pr-3 py-2.5" colSpan={2}>
                <div className="flex items-center gap-1.5 text-gray-500">
                  <span className="text-gray-300 text-base leading-none">└</span>
                  <CheckCircle size={11} className="text-green-500" />
                  <span className="text-gray-500">Оплата от {inst.paidDate}</span>
                  {inst.notes && <span className="text-gray-400 italic">— {inst.notes}</span>}
                </div>
              </td>
              <td className="px-4 py-2.5 font-semibold text-green-700">{formatMoney(inst.amount)}</td>
              <td colSpan={3} />
              <td className="px-4 py-2.5 text-right">
                <button
                  className="text-red-400 hover:text-red-600 transition-colors"
                  title="Отменить оплату"
                  onClick={e => { e.stopPropagation(); onDeletePayment(invoice.id, inst.id); }}
                >
                  <Trash2 size={13} />
                </button>
              </td>
            </tr>
          )) : (
            <tr className="border-b border-gray-100 text-xs bg-indigo-50/20">
              <td className="pl-14 pr-3 py-2.5 text-gray-400 italic" colSpan={7}>Платежей ещё нет</td>
            </tr>
          )}
        </>
      )}

      {isExpanded && hasHistory && (
        <>
          <tr className="border-b border-gray-100 bg-gray-50/60">
            <td className="pl-14 pr-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide" colSpan={7}>
              <div className="flex items-center gap-1.5">
                <History size={11} /> История аннулированных счетов
              </div>
            </td>
          </tr>
          {voidedInvoices.map(vi => (
            <tr key={`voided-${vi.id}`} className="border-b border-gray-100 text-xs bg-gray-50/40 opacity-70">
              <td className="pl-14 pr-3 py-2" colSpan={3}>
                <div className="flex items-center gap-2 text-gray-400">
                  <XCircle size={11} className="text-gray-300 flex-shrink-0" />
                  <span className="line-through">{vi.invoiceNumber}</span>
                  <span className="text-gray-300">·</span>
                  <span>от {vi.invoiceDate || vi.createdAt?.slice(0, 10)}</span>
                  {vi.notes && <span className="italic text-gray-300">— {vi.notes}</span>}
                </div>
              </td>
              <td className="px-4 py-2 text-gray-400 line-through">{formatMoney(vi.amount)}</td>
              <td className="px-4 py-2 text-gray-400">{vi.paidAmount > 0 ? formatMoney(vi.paidAmount) : '—'}</td>
              <td className="px-4 py-2" colSpan={2}><InvoiceBadge status={vi.status} inactive={true} /></td>
            </tr>
          ))}
        </>
      )}
    </>
  );
}
