/**
 * SLAM 配置解析器 (简单的 YAML 解析)
 */
export const parseSLAMConfig = (yamlText, imageUrl) => {
    const lines = yamlText.split('\n');
    const config = { imageUrl };

    lines.forEach(line => {
        if (line.includes('resolution:')) {
            config.resolution = parseFloat(line.split(':')[1].trim());
        }
        if (line.includes('origin:')) {
            const match = line.match(/\[([^\]]+)\]/);
            if (match) {
                config.origin = match[1].split(',').map(v => parseFloat(v.trim()));
            }
        }
    });

    return config;
};
