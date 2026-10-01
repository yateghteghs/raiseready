import {
  MoneyField,
  SelectField,
  TextareaField,
  TextField,
  YesNoField,
} from "@/components/forms/fields";
import type { FieldErrors } from "@/lib/forms";
import {
  COUNTRY_OPTIONS,
  CURRENCY_OPTIONS,
  FUNDING_TYPE_OPTIONS,
  INDUSTRY_OPTIONS,
  STAGE_OPTIONS,
} from "@/lib/startups/options";

type SectionProps = { values: Record<string, string>; errors?: FieldErrors };

export function AboutYouFields({ values, errors }: SectionProps) {
  return (
    <div className="grid gap-5">
      <TextField
        name="full_name"
        label="Your full name"
        autoComplete="name"
        defaultValue={values.full_name}
        errors={errors}
      />
      <SelectField
        name="country"
        label="Where are you based?"
        options={COUNTRY_OPTIONS}
        defaultValue={values.country}
        errors={errors}
      />
    </div>
  );
}

export function CompanyFields({ values, errors }: SectionProps) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <TextField
        name="name"
        label="Startup name"
        autoComplete="organization"
        defaultValue={values.name}
        errors={errors}
        className="sm:col-span-2"
      />
      <TextField
        name="website"
        label="Website"
        inputMode="url"
        placeholder="example.com"
        optional
        defaultValue={values.website}
        errors={errors}
        className="sm:col-span-2"
      />
      <SelectField
        name="industry"
        label="Industry"
        options={INDUSTRY_OPTIONS}
        defaultValue={values.industry}
        errors={errors}
      />
      <SelectField
        name="startup_country"
        label="Main market"
        options={COUNTRY_OPTIONS}
        defaultValue={values.startup_country}
        errors={errors}
      />
      <SelectField
        name="stage"
        label="Stage"
        options={STAGE_OPTIONS}
        defaultValue={values.stage}
        errors={errors}
      />
      <TextField
        name="founding_year"
        label="Year founded"
        inputMode="numeric"
        placeholder="2023"
        optional
        defaultValue={values.founding_year}
        errors={errors}
      />
    </div>
  );
}

export function TractionFields({ values, errors }: SectionProps) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <TextareaField
        name="business_model"
        label="How do you make money?"
        hint="E.g. 2% fee per transaction, monthly subscription per shop."
        optional
        defaultValue={values.business_model}
        errors={errors}
        className="sm:col-span-2"
      />
      <MoneyField
        name="revenue_monthly"
        currencyName="revenue_currency"
        label="Monthly revenue"
        hint="Your most recent full month. Leave blank if pre-revenue."
        optional
        defaultValue={values.revenue_monthly}
        defaultCurrency={values.revenue_currency}
        currencyOptions={CURRENCY_OPTIONS}
        errors={errors}
      />
      <TextField
        name="customers_count"
        label="Paying customers"
        inputMode="numeric"
        optional
        defaultValue={values.customers_count}
        errors={errors}
      />
      <TextareaField
        name="growth_notes"
        label="Growth so far"
        hint="E.g. revenue grew 15% month on month since January."
        optional
        defaultValue={values.growth_notes}
        errors={errors}
        className="sm:col-span-2"
      />
    </div>
  );
}

export function FundraisingFields({ values, errors }: SectionProps) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <YesNoField
        name="raising"
        label="Are you raising now, or planning to soon?"
        defaultValue={values.raising || "yes"}
        errors={errors}
      />
      <YesNoField
        name="previously_raised"
        label="Have you raised money before?"
        optional
        defaultValue={values.previously_raised}
        errors={errors}
      />
      <MoneyField
        name="amount_seeking"
        currencyName="seeking_currency"
        label="Amount you're raising"
        hint="Required if you're raising."
        defaultValue={values.amount_seeking}
        defaultCurrency={values.seeking_currency}
        currencyOptions={CURRENCY_OPTIONS}
        errors={errors}
      />
      <SelectField
        name="funding_type"
        label="Type of funding"
        options={FUNDING_TYPE_OPTIONS}
        optional
        defaultValue={values.funding_type}
        errors={errors}
      />
      <TextareaField
        name="use_of_funds"
        label="What will you use the money for?"
        hint="E.g. 40% hiring engineers, 30% expansion to Ghana, 30% marketing."
        optional
        defaultValue={values.use_of_funds}
        errors={errors}
        className="sm:col-span-2"
      />
    </div>
  );
}
