type Props = {
    locked: boolean;
    orderNumber: string;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    onOrderNumberChange: (value: string) => void;
    onCustomerNameChange: (value: string) => void;
    onCustomerEmailChange: (value: string) => void;
    onCustomerPhoneChange: (value: string) => void;
  };
  
  export default function OrderDetailsFields({
    locked,
    orderNumber,
    customerName,
    customerEmail,
    customerPhone,
    onOrderNumberChange,
    onCustomerNameChange,
    onCustomerEmailChange,
    onCustomerPhoneChange,
  }: Props) {
    return (
      <fieldset
        disabled={locked}
        className="min-w-0"
      >
        <legend className="text-xl font-semibold">
          Order details
        </legend>
  
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium">
            Order number
  
            <input
              type="text"
              required
              value={orderNumber}
              onChange={(event) =>
                onOrderNumberChange(event.target.value)
              }
              placeholder="e.g. ILF-1058"
              maxLength={80}
              className="rounded-lg border border-slate-300 px-4 py-3 text-base outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-50"
            />
          </label>
  
          <label className="grid gap-2 text-sm font-medium">
            Customer name
  
            <input
              type="text"
              required
              value={customerName}
              onChange={(event) =>
                onCustomerNameChange(event.target.value)
              }
              placeholder="Customer name"
              maxLength={80}
              className="rounded-lg border border-slate-300 px-4 py-3 text-base outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-50"
            />
          </label>
        </div>
  
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium">
            Email
  
            <input
              type="email"
              value={customerEmail}
              onChange={(event) =>
                onCustomerEmailChange(event.target.value)
              }
              placeholder="customer@email.com"
              maxLength={254}
              className="rounded-lg border border-slate-300 px-4 py-3 text-base outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-50"
            />
          </label>
  
          <label className="grid gap-2 text-sm font-medium">
            Mobile
  
            <input
              type="tel"
              value={customerPhone}
              onChange={(event) =>
                onCustomerPhoneChange(event.target.value)
              }
              placeholder="07700 123456"
              maxLength={30}
              className="rounded-lg border border-slate-300 px-4 py-3 text-base outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-50"
            />
          </label>
        </div>
  
        <p className="mt-3 text-xs text-slate-500">
          Email or mobile is required if the
          customer will upload later.
        </p>
      </fieldset>
    );
  }
  