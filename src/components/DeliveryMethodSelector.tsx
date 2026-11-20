import React from 'react';
import { Clock, Mail, MapPin, Store, Truck } from 'lucide-react';
import {
  formatPrice,
  POST_OFFICE_TOWN_GROUPS,
  POST_OFFICE_TOWNS,
  siteConfig,
} from '../config/siteConfig';
import { BranchId, DeliveryMethod, DRIVER_DELIVERY_FEE } from '../types/fragrance';

interface DeliveryMethodSelectorProps {
  deliveryMethod: DeliveryMethod;
  selectedBranch: BranchId;
  postOfficeTown: string;
  deliveryAddress: string;
  postOfficeError?: boolean;
  deliveryAddressError?: boolean;
  onSelectDeliveryMethod: (method: DeliveryMethod) => void;
  onSelectBranch: (branch: BranchId) => void;
  onPostOfficeTownChange: (town: string) => void;
  onDeliveryAddressChange: (address: string) => void;
  townInputRef?: React.RefObject<HTMLSelectElement | null>;
  addressInputRef?: React.RefObject<HTMLInputElement | null>;
  compact?: boolean;
}

export const DeliveryMethodSelector: React.FC<DeliveryMethodSelectorProps> = ({
  deliveryMethod,
  selectedBranch,
  postOfficeTown,
  deliveryAddress,
  postOfficeError = false,
  deliveryAddressError = false,
  onSelectDeliveryMethod,
  onSelectBranch,
  onPostOfficeTownChange,
  onDeliveryAddressChange,
  townInputRef,
  addressInputRef,
  compact = false,
}) => {
  const activeBranch =
    siteConfig.branches.find((b) => b.id === selectedBranch) ??
    siteConfig.branches[0];

  const options: {
    id: DeliveryMethod;
    label: string;
    badge: string;
    icon: React.ReactNode;
  }[] = [
    {
      id: 'store-pickup',
      label: 'Store Pickup',
      badge: 'Free',
      icon: <Store className="w-4 h-4" />,
    },
    {
      id: 'post-office',
      label: 'Post Office',
      badge: 'Select Town',
      icon: <Mail className="w-4 h-4" />,
    },
    {
      id: 'driver-delivery',
      label: 'Driver Delivery',
      badge: `+${formatPrice(DRIVER_DELIVERY_FEE)}`,
      icon: <Truck className="w-4 h-4" />,
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#0A0A0A]">
          <MapPin className="w-3.5 h-3.5 text-[#0A0A0A]" />
          <span>Collection / Delivery Method</span>
        </span>
        {deliveryMethod === 'driver-delivery' && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#FACC15] text-[#0A0A0A] text-[10px] font-bold uppercase tracking-wider">
            +{formatPrice(DRIVER_DELIVERY_FEE)} Fee Added
          </span>
        )}
      </div>

      {/* 3 Fulfillment Method Options */}
      <div className="grid grid-cols-3 gap-2">
        {options.map((opt) => {
          const active = deliveryMethod === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onSelectDeliveryMethod(opt.id)}
              aria-pressed={active}
              className={`flex flex-col items-center justify-center text-center rounded-xl border transition-colors ${
                compact ? 'py-2 px-1.5' : 'py-2.5 px-2'
              } ${
                active
                  ? 'bg-[#0A0A0A] text-white border-[#0A0A0A]'
                  : 'bg-white text-[#0A0A0A] border-[#D4D4D4] hover:border-[#0A0A0A]'
              }`}
            >
              <span className="mb-1">{opt.icon}</span>
              <span className="text-[11px] sm:text-xs font-semibold leading-tight">
                {opt.label}
              </span>
              <span
                className={`text-[10px] mt-0.5 tabular-nums font-medium ${
                  opt.id === 'driver-delivery'
                    ? active
                      ? 'text-[#FACC15] font-bold'
                      : 'text-[#DC2626] font-bold'
                    : active
                    ? 'text-white/75'
                    : 'text-[#666666]'
                }`}
              >
                {opt.badge}
              </span>
            </button>
          );
        })}
      </div>

      {/* Contextual Inputs Based on Selected Delivery Method */}
      {deliveryMethod === 'store-pickup' && (
        <div className="space-y-2 bg-white border border-[#E5E5E5] rounded-xl p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#525252]">
            Select Store Branch for Collection
          </p>
          <div className="grid grid-cols-2 gap-2">
            {siteConfig.branches.map((branch) => {
              const active = selectedBranch === branch.id;
              return (
                <button
                  key={branch.id}
                  type="button"
                  onClick={() => onSelectBranch(branch.id)}
                  className={`py-2 px-2.5 rounded-lg text-xs font-medium border transition-colors text-center ${
                    active
                      ? 'bg-[#0A0A0A] text-white border-[#0A0A0A]'
                      : 'bg-[#F6F6F7] text-[#0A0A0A] border-[#D4D4D4] hover:border-[#0A0A0A]'
                  }`}
                >
                  {branch.city} Store
                </button>
              );
            })}
          </div>
          {activeBranch && (
            <div className="text-[11px] text-[#525252] leading-relaxed pt-0.5 space-y-0.5">
              <div className="flex items-center justify-between gap-2 text-[#0A0A0A] font-medium">
                <span>{activeBranch.name}</span>
                <span className="inline-flex items-center gap-1 text-[#525252] font-normal">
                  <Clock className="w-3 h-3" />
                  {activeBranch.openingHours.weekdays}
                </span>
              </div>
              <p>{activeBranch.address}</p>
            </div>
          )}
        </div>
      )}

      {deliveryMethod === 'post-office' && (
        <div
          className={`space-y-2.5 bg-white border rounded-xl p-3 ${
            postOfficeError ? 'border-[#DC2626]' : 'border-[#E5E5E5]'
          }`}
        >
          <div className="space-y-1">
            <label
              htmlFor={compact ? 'post-office-town-compact' : 'post-office-town'}
              className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-[#0A0A0A]"
            >
              <span>Destination Town *</span>
              <span className="text-[#666666] font-normal normal-case tracking-normal">
                Post Office Parcel
              </span>
            </label>
            <select
              ref={townInputRef}
              id={compact ? 'post-office-town-compact' : 'post-office-town'}
              required
              aria-required="true"
              value={postOfficeTown}
              onChange={(e) => onPostOfficeTownChange(e.target.value)}
              className={`w-full px-3 py-2 bg-[#F6F6F7] border rounded-lg text-xs text-[#0A0A0A] focus:outline-none focus:bg-white ${
                postOfficeError
                  ? 'border-[#DC2626] focus:border-[#DC2626]'
                  : 'border-[#D4D4D4] focus:border-[#0A0A0A]'
              }`}
            >
              <option value="">Select destination town...</option>
              {postOfficeTown.trim() &&
                !POST_OFFICE_TOWNS.includes(postOfficeTown.trim()) && (
                  <option value={postOfficeTown}>{postOfficeTown}</option>
                )}
              {POST_OFFICE_TOWN_GROUPS.map((group) => (
                <optgroup key={group.region} label={group.region}>
                  {group.towns.map((town) => (
                    <option key={town} value={town}>
                      {town}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {postOfficeError && (
              <p className="text-[11px] text-[#DC2626] font-medium">
                Please select your destination town for Post Office collection.
              </p>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#F0F0F0]">
            <span className="text-[11px] text-[#525252]">Dispatch from:</span>
            <div className="flex gap-1.5">
              {siteConfig.branches.map((branch) => {
                const active = selectedBranch === branch.id;
                return (
                  <button
                    key={branch.id}
                    type="button"
                    onClick={() => onSelectBranch(branch.id)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors ${
                      active
                        ? 'bg-[#0A0A0A] text-white border-[#0A0A0A]'
                        : 'bg-white text-[#525252] border-[#D4D4D4] hover:border-[#0A0A0A]'
                    }`}
                  >
                    {branch.city}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {deliveryMethod === 'driver-delivery' && (
        <div
          className={`space-y-2.5 bg-white border rounded-xl p-3 ${
            deliveryAddressError ? 'border-[#DC2626]' : 'border-[#0A0A0A]/25'
          }`}
        >
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-[#0A0A0A]">
              Driver Delivery Fee
            </span>
            <span className="font-bold text-[#DC2626] tabular-nums">
              +{formatPrice(DRIVER_DELIVERY_FEE)} added to total
            </span>
          </div>
          <div className="space-y-1">
            <label
              htmlFor={compact ? 'driver-address-compact' : 'driver-address'}
              className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-[#0A0A0A]"
            >
              <span>Delivery Area / Address *</span>
              <span className="text-[#666666] font-normal normal-case tracking-normal">
                Required
              </span>
            </label>
            <input
              ref={addressInputRef}
              id={compact ? 'driver-address-compact' : 'driver-address'}
              type="text"
              required
              aria-required="true"
              value={deliveryAddress}
              onChange={(e) => onDeliveryAddressChange(e.target.value)}
              placeholder="Enter delivery area / address (e.g. Manzini CBD, Fairview, Eveni)"
              maxLength={120}
              className={`w-full px-3 py-2 bg-[#F6F6F7] border rounded-lg text-xs text-[#0A0A0A] placeholder:text-[#737373] focus:outline-none focus:bg-white ${
                deliveryAddressError
                  ? 'border-[#DC2626] focus:border-[#DC2626]'
                  : 'border-[#D4D4D4] focus:border-[#0A0A0A]'
              }`}
            />
            {deliveryAddressError && (
              <p className="text-[11px] text-[#DC2626] font-medium">
                Please enter your delivery area or street address for the driver.
              </p>
            )}
          </div>
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#F0F0F0]">
            <span className="text-[11px] text-[#525252]">Dispatched from:</span>
            <div className="flex gap-1.5">
              {siteConfig.branches.map((branch) => {
                const active = selectedBranch === branch.id;
                return (
                  <button
                    key={branch.id}
                    type="button"
                    onClick={() => onSelectBranch(branch.id)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors ${
                      active
                        ? 'bg-[#0A0A0A] text-white border-[#0A0A0A]'
                        : 'bg-white text-[#525252] border-[#D4D4D4] hover:border-[#0A0A0A]'
                    }`}
                  >
                    {branch.city}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
