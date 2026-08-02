import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Calendar, Clock, Package, Truck, Store } from 'lucide-react';
import { reservationsApi } from '../../lib/api';
import { Reservation } from '../../types';
import { formatDate, getStatusColor, getStatusLabel } from '../../lib/utils';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

const ReservationHistory = () => {
  const { t } = useTranslation();

  const { data, isLoading } = useQuery({
    queryKey: ['my-reservations'],
    queryFn: () => reservationsApi.getMyReservations().then((r) => r.data.data as Reservation[]),
  });

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><LoadingSpinner /></div>;

  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <h1 className="font-serif text-3xl font-bold mb-8">{t('account.reservations')}</h1>

      {(!data || data.length === 0) ? (
        <div className="text-center py-16">
          <Package size={48} className="mx-auto mb-4 text-muted-foreground/30" />
          <h3 className="font-semibold mb-2">No reservations yet</h3>
          <p className="text-muted-foreground mb-4">Start by browsing our collection and making your first reservation.</p>
          <Link to="/products" className="inline-block px-6 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors">
            Browse Products
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {data.map((reservation) => (
            <div key={reservation.id} className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <p className="font-mono text-sm font-bold text-primary">{reservation.reservationNumber}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Created {formatDate(reservation.createdAt)}</p>
                </div>
                <span className={`px-3 py-1 text-xs font-medium rounded-full border ${getStatusColor(reservation.status)}`}>
                  {getStatusLabel(reservation.status)}
                </span>
              </div>

              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-3">
                {reservation.fulfillmentType === 'DELIVERY' ? (
                  <div className="flex items-center gap-1.5">
                    <Truck size={13} />
                    {reservation.deliveryAddress
                      ? `${reservation.deliveryAddress.district}, ${reservation.deliveryAddress.province}`
                      : 'Home Delivery'}
                  </div>
                ) : reservation.fulfillmentType === 'PICKUP' ? (
                  <div className="flex items-center gap-1.5"><Store size={13} />Pickup at Store</div>
                ) : reservation.visitDate ? (
                  <>
                    <div className="flex items-center gap-1.5"><Calendar size={13} />{formatDate(reservation.visitDate)}</div>
                    {reservation.visitTime && <div className="flex items-center gap-1.5"><Clock size={13} />{reservation.visitTime}</div>}
                  </>
                ) : null}
                <div className="flex items-center gap-1.5"><Package size={13} />{reservation.items?.length || 0} item(s)</div>
              </div>

              <Link to={`/track?ref=${reservation.reservationNumber}`}
                className="text-sm text-primary font-medium hover:underline">
                Track this reservation →
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ReservationHistory;
