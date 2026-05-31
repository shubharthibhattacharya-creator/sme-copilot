'use client'
import React from 'react'
import { Button } from './button'
import { Label } from './typography'

function Spinner({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none"
      style={{ animation: 'spin 0.8s linear infinite' }}>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity=".3" strokeWidth="2"/>
      <path d="M14 8a6 6 0 00-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </svg>
  )
}

interface Step {
  id: string
  title: string
  optional?: boolean
}

interface MultiStepFormProps {
  steps: Step[]
  currentStep: number
  children: React.ReactNode
  onNext: () => void
  onBack: () => void
  onComplete: () => void
  isLastStep: boolean
  isSaving?: boolean
}

export function MultiStepForm({
  steps, currentStep, children, onNext, onBack,
  onComplete, isLastStep, isSaving,
}: MultiStepFormProps) {
  return (
    <div style={{ maxWidth: '560px', margin: '0 auto' }}>
      {/* Step progress */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '32px' }}>
        {steps.map((step, i) => (
          <React.Fragment key={step.id}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: i < steps.length - 1 ? 1 : 0 }}>
              <div style={{
                width: '28px', height: '28px', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: i <= currentStep ? 'var(--color-primary)' : 'var(--color-border)',
                color: i <= currentStep ? '#fff' : 'var(--color-text-tertiary)',
                fontSize: '12px', fontWeight: 600, flexShrink: 0,
                transition: 'background var(--transition-base)',
              }}>
                {i < currentStep
                  ? <svg width={14} height={14} viewBox="0 0 16 16" fill="none"><path d="M3 8l4 4 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  : i + 1}
              </div>
              <Label style={{ marginTop: '4px', textAlign: 'center', fontSize: '11px' }}>{step.title}</Label>
            </div>
            {i < steps.length - 1 && (
              <div style={{
                flex: 1,
                height: '1px',
                background: i < currentStep ? 'var(--color-primary)' : 'var(--color-border)',
                margin: '0 8px',
                marginBottom: '20px',
                transition: 'background var(--transition-base)',
              }} />
            )}
          </React.Fragment>
        ))}
      </div>

      {isSaving && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '16px', color: 'var(--color-text-tertiary)', fontSize: '12px' }}>
          <Spinner size={12} />
          Saving…
        </div>
      )}

      <div style={{ marginBottom: '32px' }}>{children}</div>

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Button variant="ghost" onClick={onBack} disabled={currentStep === 0}>Back</Button>
        <Button variant="primary" onClick={isLastStep ? onComplete : onNext}>
          {isLastStep ? 'Complete' : 'Continue'}
        </Button>
      </div>
    </div>
  )
}

interface FormFieldProps {
  label: string
  required?: boolean
  error?: string
  hint?: string
  children: React.ReactNode
}

export function FormField({ label, required, error, hint, children }: FormFieldProps) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <label style={{
        display: 'block',
        marginBottom: '5px',
        fontFamily: 'var(--font-family)',
        fontSize: '12px',
        fontWeight: 500,
        color: error ? 'var(--color-error)' : 'var(--color-text-secondary)',
      }}>
        {label}
        {required && <span style={{ color: 'var(--color-error)', marginLeft: '2px' }}>*</span>}
      </label>
      {children}
      {error && (
        <p style={{ marginTop: '4px', fontSize: '12px', color: 'var(--color-error)', fontFamily: 'var(--font-family)', margin: '4px 0 0' }}>
          {error}
        </p>
      )}
      {hint && !error && (
        <p style={{ marginTop: '4px', fontSize: '12px', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)', margin: '4px 0 0' }}>
          {hint}
        </p>
      )}
    </div>
  )
}
