import React from 'react';
import { Input, InputProps } from '../../atoms/Input';

/** FormField props - Input의 확장 가능 래퍼 */
type FormFieldProps = InputProps;

// Currently just a re-export or lightweight wrapper as Input handles Label/Error internally.
// In complex systems, this might handle layout (grid, flex) different from the Input atom.
export const FormField = (props: FormFieldProps) => {
    return <Input {...props} />;
};
