// Single shared definition of the Amplify Authenticator form fields.
// Previously this block was copy-pasted in Welcome.jsx and Chat.jsx.
export const formFields = {
    signIn: {
        username: {
            label: "Email",
            placeholder: "Enter your email",
            type: "email", // Ensures mobile keyboard shows @ symbol
            isRequired: true,
        },
    },
    signUp: {
        username: {
            label: "Email",
            placeholder: "Enter your email",
            type: "email",
            isRequired: true,
            order: 1,
        },
        password: {
            label: "Password",
            placeholder: "Enter your password",
            isRequired: true,
            order: 2,
        },
        confirm_password: {
            label: "Confirm Password",
            placeholder: "Please confirm your password",
            order: 3,
        },
    },
    forgotPassword: {
        username: {
            label: "Email",
            placeholder: "Enter your email",
        },
    },
};
