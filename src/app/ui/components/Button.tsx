import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

export default function Button({ children, className = "", ...props }: ButtonProps) {
  return (
    <button
      className={`px-6 py-3 text-lg font-medium bg-gray-900 text-white rounded-xl transition-all hover:bg-gray-700 dark:bg-gray-200 dark:text-gray-900 dark:hover:bg-gray-300 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
