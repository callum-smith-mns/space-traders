import { useState } from 'react';
import { api, type Contract } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useContracts, useAcceptContract } from '../hooks/useQueries';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../hooks/useQueries';
import LoadingSpinner from './LoadingSpinner';
import './ContractsWindow.css';

interface ContractsWindowProps {
  selectedShipSymbol?: string | null;
}

export default function ContractsWindow({ selectedShipSymbol }: ContractsWindowProps) {
  const { setAgent } = useAuth();
  const { data: contracts, isLoading, error, isFetching } = useContracts();
  const acceptMutation = useAcceptContract();
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [negotiating, setNegotiating] = useState(false);
  const [fulfilling, setFulfilling] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleRefresh = () => {
    qc.invalidateQueries({ queryKey: queryKeys.contracts });
  };

  const handleAccept = async (contractId: string) => {
    try {
      setActionError(null);
      const result = await acceptMutation.mutateAsync(contractId);
      setAgent(result.agent);
    } catch {
      // error is available via acceptMutation.error
    }
  };

  const handleNegotiate = async () => {
    if (!selectedShipSymbol) return;
    setNegotiating(true);
    setActionError(null);
    try {
      const result = await api.negotiateContract(selectedShipSymbol);
      // Add the new contract to the cache
      qc.setQueryData<Contract[]>(queryKeys.contracts, (old) =>
        old ? [...old, result.contract] : [result.contract]
      );
      setExpanded(result.contract.id);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to negotiate contract');
    } finally {
      setNegotiating(false);
    }
  };

  const handleFulfill = async (contractId: string) => {
    setFulfilling(contractId);
    setActionError(null);
    try {
      const result = await api.fulfillContract(contractId);
      setAgent(result.agent);
      qc.setQueryData<Contract[]>(queryKeys.contracts, (old) =>
        old?.map((c) => (c.id === result.contract.id ? result.contract : c))
      );
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to fulfill contract');
    } finally {
      setFulfilling(null);
    }
  };

  if (isLoading) {
    return <LoadingSpinner message="Scanning contracts…" />;
  }

  if (error) {
    return <div className="contracts-error">{error instanceof Error ? error.message : 'Failed to load contracts'}</div>;
  }

  if (!contracts || contracts.length === 0) {
    return (
      <div className="contracts-empty">
        <p>No contracts available.</p>
        {selectedShipSymbol && (
          <button
            className="contract-negotiate-btn"
            onClick={handleNegotiate}
            disabled={negotiating}
          >
            {negotiating ? 'Negotiating…' : 'Negotiate New Contract'}
          </button>
        )}
        {actionError && <div className="contract-action-error">{actionError}</div>}
      </div>
    );
  }

  // An active contract is one that's accepted but not yet fulfilled and not expired
  const hasActiveContract = contracts.some(
    (c) => c.accepted && !c.fulfilled && new Date(c.terms.deadline) > new Date()
  );

  // Sort: unaccepted first, then by deadline
  const sorted = [...contracts].sort((a: Contract, b: Contract) => {
    if (a.accepted !== b.accepted) return a.accepted ? 1 : -1;
    return new Date(a.terms.deadline).getTime() - new Date(b.terms.deadline).getTime();
  });

  return (
    <div className="contracts-list">
      <div className="contracts-toolbar">
        <button
          className="contracts-negotiate-btn"
          onClick={handleNegotiate}
          disabled={negotiating || hasActiveContract || !selectedShipSymbol}
          title={
            !selectedShipSymbol
              ? 'Select a ship to negotiate'
              : hasActiveContract
                ? 'Complete your active contract first'
                : 'Negotiate a new contract'
          }
        >
          {negotiating ? 'Negotiating…' : 'Negotiate'}
        </button>
        <button
          className="contracts-refresh-btn"
          onClick={handleRefresh}
          disabled={isFetching}
          title="Refresh contracts"
        >
          <span className={`contracts-refresh-icon ${isFetching ? 'contracts-refresh-icon--spinning' : ''}`}>⟳</span>
        </button>
      </div>
      {actionError && <div className="contract-action-error">{actionError}</div>}
      {sorted.map((contract) => {
        const isExpanded = expanded === contract.id;
        const isNew = !contract.accepted && !contract.fulfilled;
        const isFulfilled = contract.fulfilled;
        const isExpired = new Date(contract.expiration) < new Date();
        const deadlineToAccept = contract.deadlineToAccept
          ? new Date(contract.deadlineToAccept)
          : null;
        const acceptExpired = deadlineToAccept ? deadlineToAccept < new Date() : false;

        return (
          <div
            key={contract.id}
            className={`contract-row ${isExpanded ? 'contract-row--expanded' : ''} ${isNew ? 'contract-row--new' : ''} ${isFulfilled ? 'contract-row--fulfilled' : ''}`}
            onClick={() => setExpanded(isExpanded ? null : contract.id)}
          >
            {/* Summary */}
            <div className="contract-summary">
              <div className="contract-type-badge">
                {contract.type}
              </div>

              <div className="contract-id-block">
                <span className="contract-faction">{contract.factionSymbol}</span>
                <span className="contract-id">{contract.id.slice(0, 8)}…</span>
              </div>

              <ContractStatusBadge
                accepted={contract.accepted}
                fulfilled={contract.fulfilled}
                isExpired={isExpired}
                acceptExpired={acceptExpired}
              />

              <div className="contract-payment-mini">
                <span className="contract-payment-label">¢</span>
                <span className="contract-payment-value">
                  {(contract.terms.payment.onAccepted + contract.terms.payment.onFulfilled).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Expanded detail */}
            {isExpanded && (
              <div className="contract-detail">
                {/* Payment */}
                <div className="contract-section">
                  <div className="contract-section-title">Payment</div>
                  <div className="contract-stat-grid">
                    <StatItem
                      label="On Accept"
                      value={`¢ ${contract.terms.payment.onAccepted.toLocaleString()}`}
                    />
                    <StatItem
                      label="On Fulfil"
                      value={`¢ ${contract.terms.payment.onFulfilled.toLocaleString()}`}
                    />
                  </div>
                </div>

                {/* Deadlines */}
                <div className="contract-section">
                  <div className="contract-section-title">Deadlines</div>
                  <div className="contract-stat-grid">
                    <StatItem
                      label="Fulfil By"
                      value={formatDate(contract.terms.deadline)}
                    />
                    {contract.deadlineToAccept && (
                      <StatItem
                        label="Accept By"
                        value={formatDate(contract.deadlineToAccept)}
                      />
                    )}
                    <StatItem
                      label="Expires"
                      value={formatDate(contract.expiration)}
                    />
                  </div>
                </div>

                {/* Deliveries */}
                {contract.terms.deliver && contract.terms.deliver.length > 0 && (
                  <div className="contract-section">
                    <div className="contract-section-title">Deliveries</div>
                    <div className="contract-deliveries">
                      {contract.terms.deliver.map((d, i) => (
                        <div key={i} className="contract-delivery">
                          <div className="contract-delivery-header">
                            <span className="contract-delivery-good">{d.tradeSymbol}</span>
                            <span className="contract-delivery-dest">→ {d.destinationSymbol}</span>
                          </div>
                          <div className="contract-delivery-bar-wrap">
                            <div className="contract-delivery-bar-track">
                              <div
                                className="contract-delivery-bar-fill"
                                style={{
                                  width: `${d.unitsRequired > 0 ? (d.unitsFulfilled / d.unitsRequired) * 100 : 0}%`,
                                }}
                              />
                            </div>
                            <span className="contract-delivery-progress">
                              {d.unitsFulfilled} / {d.unitsRequired}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Accept button */}
                {isNew && !acceptExpired && (
                  <button
                    className="contract-accept-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAccept(contract.id);
                    }}
                    disabled={acceptMutation.isPending}
                  >
                    {acceptMutation.isPending ? 'Accepting…' : 'Accept Contract'}
                  </button>
                )}

                {/* Fulfill button — show when accepted, not fulfilled, and all deliveries met */}
                {contract.accepted && !contract.fulfilled && !isExpired && (() => {
                  const allDelivered = contract.terms.deliver
                    ? contract.terms.deliver.every((d) => d.unitsFulfilled >= d.unitsRequired)
                    : true;
                  return allDelivered ? (
                    <button
                      className="contract-fulfill-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFulfill(contract.id);
                      }}
                      disabled={fulfilling === contract.id}
                    >
                      {fulfilling === contract.id ? 'Fulfilling…' : 'Fulfill Contract'}
                    </button>
                  ) : null;
                })()}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Helpers ── */

function ContractStatusBadge({
  accepted,
  fulfilled,
  isExpired,
  acceptExpired,
}: {
  accepted: boolean;
  fulfilled: boolean;
  isExpired: boolean;
  acceptExpired: boolean;
}) {
  if (fulfilled) {
    return <span className="contract-status contract-status--fulfilled">FULFILLED</span>;
  }
  if (isExpired || acceptExpired) {
    return <span className="contract-status contract-status--expired">EXPIRED</span>;
  }
  if (!accepted) {
    return <span className="contract-status contract-status--available">AVAILABLE</span>;
  }
  return <span className="contract-status contract-status--active">ACTIVE</span>;
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="contract-stat-item">
      <span className="contract-stat-label">{label}</span>
      <span className="contract-stat-value">{value}</span>
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
