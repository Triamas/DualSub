import React from 'react';
import { AssStyleConfig } from '../types';

interface VisualPreviewProps {
    config: AssStyleConfig;
    original: string;
    translated: string;
    isSample?: boolean;
}

export const VisualPreview = React.memo<VisualPreviewProps>(({ 
    config, 
    original, 
    translated,
    isSample = false
}) => {
    
    // Green Screen Background for Contrast Check
    const containerStyle: React.CSSProperties = {
        aspectRatio: '16/9',
        backgroundColor: '#166534', 
        backgroundImage: 'radial-gradient(circle at center, #4ade80 0%, #14532d 100%)',
        position: 'relative',
        overflow: 'hidden',
        borderRadius: '0.75rem',
        border: '1px solid #3f3f46',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 50px -12px rgba(0, 0, 0, 0.5)'
    };

    // Reduced scale to simulate 4K TV resolution proportions on small preview
    const SCALE = 0.25; 
    
    const displayOriginal = original || "Original Text Placeholder";
    const displayTranslated = translated || "Translated Text Placeholder";

    if (config.outputFormat === 'srt') {
        return (
            <div style={containerStyle} className="group" aria-label="Subtitle Preview">
                 <div className="absolute inset-0 pointer-events-none opacity-20" 
                      style={{backgroundImage: 'linear-gradient(#333 1px, transparent 1px), linear-gradient(90deg, #333 1px, transparent 1px)', backgroundSize: '40px 40px'}}>
                 </div>
                 {isSample && <div className="absolute top-2 right-2 px-2 py-1 bg-zinc-800/80 rounded text-xs text-zinc-400 font-mono">SRT PREVIEW</div>}
                
                <div style={{position: 'absolute', bottom: '10%', left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', padding: '0 2rem', zIndex: 10, textAlign: 'center', gap: '8px'}}>
                    {config.stackOrder === 'primary-top' ? (
                        <>
                             <div style={{color: config.primary.color, fontSize: '18px', fontWeight: 'bold', textShadow: '2px 2px 0 #000'}}>{displayTranslated}</div>
                             <div style={{color: config.secondary.color, fontSize: '18px', fontWeight: 'bold', textShadow: '2px 2px 0 #000'}}>{displayOriginal}</div>
                        </>
                    ) : (
                        <>
                             <div style={{color: config.secondary.color, fontSize: '18px', fontWeight: 'bold', textShadow: '2px 2px 0 #000'}}>{displayOriginal}</div>
                             <div style={{color: config.primary.color, fontSize: '18px', fontWeight: 'bold', textShadow: '2px 2px 0 #000'}}>{displayTranslated}</div>
                        </>
                    )}
                </div>
            </div>
        );
    }

    const getTextStyle = (isPrimary: boolean) => {
        const style = isPrimary ? config.primary : config.secondary;
        const color = style.color;
        const size = style.fontSize * SCALE;
        const outlineW = config.outlineWidth; 
        const shadowD = config.shadowDepth; 
        const shadowColor = 'rgba(0,0,0,0.8)';
        
        let textShadows = [];
        if (outlineW > 0) {
            const stroke = Math.max(1, outlineW * 0.8); 
            for(let x = -1; x <= 1; x++) {
                for(let y = -1; y <= 1; y++) {
                    if(x!==0 || y!==0) textShadows.push(`${x*stroke}px ${y*stroke}px 0 #000`);
                }
            }
        }
        if (shadowD > 0) {
             textShadows.push(`${shadowD * 1.5}px ${shadowD * 1.5}px 2px ${shadowColor}`);
        }
        
        return {
            fontFamily: config.fontFamily,
            fontSize: `${size}px`,
            color: color,
            textShadow: textShadows.length ? textShadows.join(',') : 'none',
            textAlign: 'center' as const,
            fontWeight: 600,
            lineHeight: 1.25,
            margin: '4px 0',
            backgroundColor: config.borderStyle === 3 ? 'rgba(0,0,0,0.65)' : 'transparent',
            padding: config.borderStyle === 3 ? '2px 8px' : '0px',
            borderRadius: config.borderStyle === 3 ? '4px' : '0px',
            whiteSpace: 'pre-wrap' as const, 
            position: 'relative' as const,
            zIndex: 20
        };
    };

    const formatHtml = (text: string) => {
        if (!text) return { __html: "&nbsp;" };
        
        // Normalize HTML breaks to [br] first
        let content = text.replace(/<br\s*\/?>/gi, '[br]').replace(/<\/br>/gi, '[br]');
        
        if (config.linesPerSubtitle === 1) {
            content = content.replace(/\[br\]/g, ' ');
        } else {
            content = content.replace(/\[br\]/g, '<br/>');
        }
        return { __html: content };
    };

    const renderText = (isPrimary: boolean, text: string) => {
        const style = getTextStyle(isPrimary);
        const html = formatHtml(text);
        return (
            <div 
                style={style} 
                dangerouslySetInnerHTML={html} 
            />
        );
    };

    const PrimaryText = renderText(true, displayTranslated);
    const SecondaryText = renderText(false, displayOriginal);

    // Default values
    const screenPadding = config.screenPadding ?? 50;
    const verticalGap = config.verticalGap ?? 15;
    
    // Scale down padding/gap for preview (assuming preview height ~200px vs 2160px real)
    // 2160px -> 100% height. Preview is aspect ratio 16/9.
    // Let's use % for bottom position to be responsive.
    // 50px / 2160px = 2.3%
    // const scaleY = (px: number) => `${(px / 21.6)}%`; 

    let content;
    if (config.layout === 'split') {
        const MARGIN_V = '8%';
        // ... (Split logic remains same or can be updated if needed, but user focused on Stacked)
        // For split, we can just stick to top/bottom 8%
        content = (
            <>
                <div style={{position: 'absolute', top: MARGIN_V, left: 0, right: 0, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '0 2rem', zIndex: 10}}>
                    {config.stackOrder === 'primary-top' ? PrimaryText : SecondaryText}
                </div>
                <div style={{position: 'absolute', bottom: MARGIN_V, left: 0, right: 0, display: 'flex', justifyContent: 'center', alignItems: 'flex-end', padding: '0 2rem', zIndex: 10}}>
                    {config.stackOrder === 'primary-top' ? SecondaryText : PrimaryText}
                </div>
            </>
        );
    } else {
        // Stacked - Dynamic Positioning
        const bottomElem = config.stackOrder === 'primary-top' ? SecondaryText : PrimaryText;
        const topElem = config.stackOrder === 'primary-top' ? PrimaryText : SecondaryText;
        
        // In CSS, we can stack them using flex-col-reverse or just flex-col justify-end
        // But to match ASS "gap", we need to be careful.
        // Flex gap matches ASS gap if we set it right.
        
        // We need to scale the gap. 
        // Real gap is verticalGap (px in 2160p).
        // Preview gap should be proportional.
        const gapStyle = `${verticalGap * SCALE}px`;
        const bottomStyle = `${screenPadding * SCALE}px`;

        content = (
            <div style={{
                position: 'absolute', 
                bottom: bottomStyle, 
                left: 0, 
                right: 0, 
                display: 'flex', 
                flexDirection: 'column', // Stack top-to-bottom
                alignItems: 'center', 
                justifyContent: 'flex-end', // Pack at the bottom
                padding: '0 2rem', 
                zIndex: 10,
                gap: gapStyle
            }}>
                {topElem}
                {bottomElem}
            </div>
        );
    }

    return (
        <div style={containerStyle} className="group transition-all duration-300" aria-label="Subtitle Preview">
             <div className="absolute inset-0 pointer-events-none opacity-5 z-0" 
                  style={{background: 'linear-gradient(to bottom, rgba(255,255,255,0), rgba(255,255,255,0) 50%, rgba(0,0,0,0.2) 50%, rgba(0,0,0,0.2))', backgroundSize: '100% 4px'}}>
             </div>
             {isSample && <div className="absolute top-2 right-2 px-2 py-1 bg-zinc-800/80 rounded text-xs text-zinc-400 font-mono z-30 backdrop-blur-sm">ASS PREVIEW</div>}
             {content}
        </div>
    );
});
