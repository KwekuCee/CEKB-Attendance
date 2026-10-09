import React, { useState } from 'react';

interface ChurchLogoProps {
    className?: string;
    imgClassName?: string;
    alt?: string;
    fallbackText?: string;
}

export const ChurchLogo: React.FC<ChurchLogoProps> = ({
    className = 'w-10 h-10 rounded-xl overflow-hidden shadow-sm',
    imgClassName = 'w-full h-full object-contain',
    alt = 'CEKB Church Logo',
    fallbackText = 'CEKB',
}) => {
    const [hasError, setHasError] = useState(false);

    if (hasError) {
        return (
            <div className={`${className} bg-primary text-primary-foreground font-headline font-black flex items-center justify-center text-xs`}>
                {fallbackText}
            </div>
        );
    }

    return (
        <div className={className}>
            <img
                src="/icon-512.png"
                alt={alt}
                onError={() => setHasError(true)}
                className={imgClassName}
            />
        </div>
    );
};
