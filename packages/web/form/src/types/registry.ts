import type { ComponentType, ReactNode } from 'react';

export interface InputProps<TConfigResolved, TValue> {
  name: string;
  value: TValue;
  onChange: (next: TValue) => void;
  onBlur: () => void;
  config: TConfigResolved;
  error?: string;
  disabled?: boolean;
  loading: boolean;
  configError?: Error;
}

export interface InputDefinition<TConfigResolved, TValue> {
  Component: ComponentType<InputProps<TConfigResolved, TValue>>;
  defaultValue?: TValue;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type InputRegistry = Record<string, InputDefinition<any, any>>;

// Helpers used by FieldNode/builder
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type InferConfig<D> = D extends InputDefinition<infer C, any> ? C : never;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type InferValue<D> = D extends InputDefinition<any, infer V> ? V : never;

export interface LayoutComponentProps<TProps> {
  props: TProps;
  children: ReactNode;
}

export interface LayoutComponentDefinition<TProps> {
  Component: ComponentType<LayoutComponentProps<TProps>>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type LayoutComponentRegistry = Record<string, LayoutComponentDefinition<any>>;

export interface FieldWrapperProps {
  name: string;
  label?: string;
  description?: string;
  required: boolean;
  error?: string;
  touched: boolean;
  loading: boolean;
  configError?: Error;
  children: ReactNode;
}

export interface FieldWrapperDefinition {
  Component: ComponentType<FieldWrapperProps>;
}

export interface RootWrapperProps {
  children: ReactNode;
}

export interface RootWrapperDefinition {
  Component: ComponentType<RootWrapperProps>;
}

export interface FormRegistry<I extends InputRegistry, L extends LayoutComponentRegistry> {
  inputs: I;
  layouts: L;
  field: FieldWrapperDefinition;
  root?: RootWrapperDefinition;
}

export type InferLayoutComponentProps<L> = L extends LayoutComponentDefinition<infer P> ? P : never;
