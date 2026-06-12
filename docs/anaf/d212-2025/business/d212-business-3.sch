<pattern xmlns="http://purl.oclc.org/dsdl/schematron" id="business-3">
    <!-- versiunea v1.0.2 din 26.01.2025 s-a modificat regulila BR-D212-0047: praguri cas_baza in functie de bifa_cas_real,
     aplicabile doar daca bifa131 = 1 si bifa_cas_recalculat != 1 --> 
    <!-- versiunea v1.0.1 din 13.01.2025 s-au modificat regulile BR-D212-0056 si BR-D212-0057: se accepta  cass_total_ven_ai = 0 si , respectiv baza_cass_datorat_ai = 0 --> 
    <!-- versiunea v1.0.0 din 23.12.2025 conform cu d212_documentatieTehnica_v1.0.0_23122025.xls --> 
    <!-- 
       Conține reguli: 
       BR-D212-0041 … BR-D212-0075, BR-D212-0077, BR-D212-0078
    -->
    
    <title>D212 – Business validation</title> 
    
    <rule context="/*">
        
        <!-- ========================= -->
        <!-- VARIABILE COMUNE RADACINA -->
        <!-- ========================= -->
        
        <!-- d_rec, rectif1, rectif2 -->
        <let name="drec_root"  value="normalize-space(string(@d_rec))"/>
        <let name="rect1_root" value="normalize-space(string(@rectif1))"/>
        <let name="rect2_root" value="normalize-space(string(@rectif2))"/>
        
        <!-- Bife pe radacina (venituri realizate) -->
        <let name="bifa111_root" value="normalize-space(string(@bifa111))"/>
        <let name="bifa112_root" value="normalize-space(string(@bifa112))"/>
        <let name="bifa113_root" value="normalize-space(string(@bifa113))"/>
        <let name="bifa121_root" value="normalize-space(string(@bifa121))"/>
        <let name="bifa122_root" value="normalize-space(string(@bifa122))"/>
        <let name="bifa131_root" value="normalize-space(string(@bifa131))"/>
        <let name="bifa132_root" value="normalize-space(string(@bifa132))"/>
        <let name="bifa14_root"  value="normalize-space(string(@bifa14))"/>
        <let name="bifa15_root"  value="normalize-space(string(@bifa15))"/>
        <let name="bifa19_root"  value="normalize-space(string(@bifa19))"/>
        <let name="bifa23_root"  value="normalize-space(string(@bifa23))"/>
        
        <!-- Bife pe <oblig_estimat> (prima aparitie, daca exista) -->
        <let name="bifaOpt_root"
            value="normalize-space(string((.//d212:oblig_estimat/@bifa_optiune)[1]))"/>
        <let name="bifaOptCoas_root"
            value="normalize-space(string((.//d212:oblig_estimat/@bifa_optiune_coasigurat)[1]))"/>
        
        
       
        <!-- ================================================================================== -->
        <!-- [BR-D212-0041]: bifa131 -> oblig_realizat/CAS (bife + calcule)                          -->
        <!-- ================================================================================== -->
        <!-- Nod util: primul oblig_realizat (daca exista) -->
        <let name="obl_realizat"
            value="(.//d212:oblig_realizat)[1]"/>
        <let name="desc_bifa_cas_real_0041"
            value="$schema//xs:attribute[@name='bifa_cas_real']
            /xs:annotation/xs:documentation[1]"/>
        <let name="desc_bifa_cas_recalc_0042"
            value="$schema//xs:attribute[@name='bifa_cas_recalculat']
            /xs:annotation/xs:documentation[1]"/>
        <let name="desc_bifa_cas_sub_0043"
            value="$schema//xs:attribute[@name='bifa_cas_sub_plafon']
            /xs:annotation/xs:documentation[1]"/>

        <let name="desc_cas_total_ven_0045"
            value="$schema//xs:attribute[@name='cas_total_ven']
            /xs:annotation/xs:documentation[1]"/>
        <let name="desc_cas_baza_0046"
            value="$schema//xs:attribute[@name='cas_baza']
            /xs:annotation/xs:documentation[1]"/>
        <let name="desc_cas_datorat_0048"
            value="$schema//xs:attribute[@name='cas_datorat']
            /xs:annotation/xs:documentation[1]"/>
        <let name="desc_cas_retinut_0050"
            value="$schema//xs:attribute[@name='cas_retinut_platitor']
            /xs:annotation/xs:documentation[1]"/>
        <let name="desc_cas_dif_plus_0052"
            value="$schema//xs:attribute[@name='cas_dif_plus']
            /xs:annotation/xs:documentation[1]"/>

        <let name="has_bifa_cas_real_0041"    value="exists($obl_realizat/@bifa_cas_real)"/>
        <let name="has_bifa_cas_recalc_0042"  value="exists($obl_realizat/@bifa_cas_recalculat)"/>
        <let name="has_bifa_cas_sub_0043"     value="exists($obl_realizat/@bifa_cas_sub_plafon)"/>
        <let name="has_cas_total_ven_0045"    value="exists($obl_realizat/@cas_total_ven)"/>
        <let name="has_cas_baza_0046"         value="exists($obl_realizat/@cas_baza)"/>
        <let name="has_cas_datorat_0048"      value="exists($obl_realizat/@cas_datorat)"/>
        <let name="has_cas_retinut_0050"      value="exists($obl_realizat/@cas_retinut_platitor)"/>
        <let name="has_cas_dif_plus_0052"     value="exists($obl_realizat/@cas_dif_plus)"/>

        <let name="bifa_cas_real_val"
            value="normalize-space(string($obl_realizat/@bifa_cas_real))"/>
        <let name="bifa_cas_recalc_val"
            value="normalize-space(string($obl_realizat/@bifa_cas_recalculat))"/>
        <let name="bifa_cas_sub_val"
            value="normalize-space(string($obl_realizat/@bifa_cas_sub_plafon))"/>

        <!-- [BR-D212-0041]: IF bifa131==1 THEN bifa_cas_real exists -->
        <let name="isValid_0041"
            value="not($bifa131_root='1') or $has_bifa_cas_real_0041"/>

        <assert test="$isValid_0041"
            flag="fatal"
            id="BR-D212-0041">
            [BR-D212-0041]
            Daca bifa131 are valoarea 1 din elementul <value-of select="name(.)"/>,
            atunci atributul
            <value-of select="
                if (normalize-space($desc_bifa_cas_real_0041)!='')
                then $desc_bifa_cas_real_0041
                else 'bifa_cas_real'
                "/>
            (bifa_cas_real)
            din elementul <value-of select="name($obl_realizat)"/>
            trebuie sa fie completat.
        </assert>

        <!-- [BR-D212-0042]: IF bifa131==1 THEN bifa_cas_recalculat exists -->
        <let name="isValid_0042"
            value="not($bifa131_root='1') or $has_bifa_cas_recalc_0042"/>

        <assert test="$isValid_0042"
            flag="fatal"
            id="BR-D212-0042">
            [BR-D212-0042]
            Daca bifa131 are valoarea 1 din elementul <value-of select="name(.)"/>,
            atunci atributul
            <value-of select="
                if (normalize-space($desc_bifa_cas_recalc_0042)!='')
                then $desc_bifa_cas_recalc_0042
                else 'bifa_cas_recalculat'
                "/>
            (bifa_cas_recalculat)
            din elementul <value-of select="name($obl_realizat)"/>
            trebuie sa fie completat.
        </assert>

        <!-- [BR-D212-0043]: IF bifa131==1 THEN bifa_cas_sub_plafon exists -->
        <let name="isValid_0043"
            value="not($bifa131_root='1') or $has_bifa_cas_sub_0043"/>

        <assert test="$isValid_0043"
            flag="fatal"
            id="BR-D212-0043">
            [BR-D212-0043]
            Daca bifa131 are valoarea 1 din elementul <value-of select="name(.)"/>,
            atunci atributul
            <value-of select="
                if (normalize-space($desc_bifa_cas_sub_0043)!='')
                then $desc_bifa_cas_sub_0043
                else 'bifa_cas_sub_plafon'
                "/>
            (bifa_cas_sub_plafon)
            din elementul <value-of select="name($obl_realizat)"/>
            trebuie sa fie completat.
        </assert>

        <!-- [BR-D212-0044]: IF bifa_cas_sub_plafon == 1 THEN bifa_cas_recalculat = 0 si reciproca (mutual exclusive pe valoarea 1) -->
        <let name="isValid_0044"
            value="not($bifa131_root = '1')
            or not($bifa_cas_sub_val = '1' and $bifa_cas_recalc_val = '1')"/>
        
        <assert test="$isValid_0044"
            flag="fatal"
            id="BR-D212-0044">
            [BR-D212-0044]
            Atributele
            <value-of select="if (normalize-space($desc_bifa_cas_sub_0043)!='')
                then $desc_bifa_cas_sub_0043
                else 'bifa_cas_sub_plafon'"/>
            (bifa_cas_sub_plafon)
            si
            <value-of select="if (normalize-space($desc_bifa_cas_recalc_0042)!='')
                then $desc_bifa_cas_recalc_0042
                else 'bifa_cas_recalculat'"/>
            (bifa_cas_recalculat)
            din elementul <value-of select="name($obl_realizat)"/>
            nu pot fi ambele bifate in acelasi timp (nu este permis ca ambele sa aiba valoarea 1).
        </assert>
        

        <!-- [BR-D212-0045]: IF bifa131==1 THEN cas_total_ven exists -->
        <let name="isValid_0045"
            value="not($bifa131_root='1') or $has_cas_total_ven_0045"/>

        <assert test="$isValid_0045"
            flag="fatal"
            id="BR-D212-0045">
            [BR-D212-0045]
            Daca bifa131 are valoarea 1 din elementul <value-of select="name(.)"/>,
            atunci atributul
            <value-of select="
                if (normalize-space($desc_cas_total_ven_0045)!='')
                then $desc_cas_total_ven_0045
                else 'cas_total_ven'
                "/>
            (cas_total_ven)
            din elementul <value-of select="name($obl_realizat)"/>
            trebuie sa fie completat.
        </assert>

        <!-- [BR-D212-0046]: IF bifa131==1 THEN cas_baza exists -->
        <let name="isValid_0046"
            value="not($bifa131_root='1') or $has_cas_baza_0046"/>

        <assert test="$isValid_0046"
            flag="fatal"
            id="BR-D212-0046">
            [BR-D212-0046]
            Daca bifa131 are valoarea 1 din elementul <value-of select="name(.)"/>,
            atunci atributul
            <value-of select="
                if (normalize-space($desc_cas_baza_0046)!='')
                then $desc_cas_baza_0046
                else 'cas_baza'
                "/>
            (cas_baza)
            din elementul <value-of select="name($obl_realizat)"/>
            trebuie sa fie completat.
        </assert>

        <!-- [BR-D212-0047]: praguri cas_baza in functie de bifa_cas_real,
     aplicabile doar daca bifa131 = 1 si bifa_cas_recalculat != 1 -->
        
        <!-- valoare cas_baza -->
        <let name="n_cas_baza_0047"
            value="number(normalize-space(string($obl_realizat/@cas_baza)))"/>
        
        <!-- praguri -->
        <let name="min_12" value="12 * 4050"/>
        <let name="min_24" value="24 * 4050"/>
        
        <!-- valori bife -->
        <let name="bifa131_0047"
            value="normalize-space(string($bifa131_root))"/>
        
        <let name="bifa_cas_real_0047"
            value="normalize-space(string($obl_realizat/@bifa_cas_real))"/>
        
        <let name="bifa_cas_recalc_0047"
            value="normalize-space(string($obl_realizat/@bifa_cas_recalculat))"/>
        
        <!-- conditie de activare a regulii -->
        <let name="aplica_regula_0047"
            value="$bifa131_0047 = '1' and $bifa_cas_recalc_0047 != '1'"/>
        
        <!-- validare -->
        <let name="isValid_0047"
            value="
            not($aplica_regula_0047)
            or
            (
            ($bifa_cas_real_0047 = '1' and $n_cas_baza_0047 &gt;= $min_12)
            or
            ($bifa_cas_real_0047 = '2' and $n_cas_baza_0047 &gt;= $min_24)
            or
            (not($bifa_cas_real_0047 = '1' or $bifa_cas_real_0047 = '2'))
            )
            "/>
        
        <assert test="$isValid_0047"
            flag="fatal"
            id="BR-D212-0047">
            [BR-D212-0047]
            Daca bifa131 are valoarea 1 si bifa_cas_recalculat este diferita de 1, atunci:
            - daca bifa_cas_real = 1, atunci cas_baza trebuie sa fie ≥ <value-of select="$min_12"/> (12 × 4050),
            - daca bifa_cas_real = 2, atunci cas_baza trebuie sa fie ≥ <value-of select="$min_24"/> (24 × 4050).
            Element: <value-of select="name($obl_realizat)"/>.
        </assert>
        

        <!-- [BR-D212-0048]: IF bifa131==1 THEN cas_datorat exists -->
        <let name="isValid_0048"
            value="not($bifa131_root='1') or $has_cas_datorat_0048"/>

        <assert test="$isValid_0048"
            flag="fatal"
            id="BR-D212-0048">
            [BR-D212-0048]
            Daca bifa131 are valoarea 1 din elementul <value-of select="name(.)"/>,
            atunci atributul
            <value-of select="
                if (normalize-space($desc_cas_datorat_0048)!='')
                then $desc_cas_datorat_0048
                else 'cas_datorat'
                "/>
            (cas_datorat)
            din elementul <value-of select="name($obl_realizat)"/>
            trebuie sa fie completat.
        </assert>
        <!-- ===================================================================== -->
        <!-- BR-D212-0115:
     IF( (statut NOT EXISTS OR statut NOT IN (1,2,5))
         AND ( (cass_total_ven_ai + cass_ven_dpi) >= 48600
               OR bifa_cas_sub_plafon = 1 )
       )
     THEN cas_baza MUST EXISTS
-->
        <!-- ===================================================================== -->
            
            <!-- descrieri din XSD -->
            <let name="desc_statut_0115"
                value="$schema//xs:attribute[@name='statut']/xs:annotation/xs:documentation[1]"/>
            
            <let name="desc_cass_ai_0115"
                value="$schema//xs:attribute[@name='cass_total_ven_ai']/xs:annotation/xs:documentation[1]"/>
            
            <let name="desc_cass_dpi_0115"
                value="$schema//xs:attribute[@name='cass_ven_dpi']/xs:annotation/xs:documentation[1]"/>
            
            <let name="desc_bifa_sub_0115"
                value="$schema//xs:attribute[@name='bifa_cas_sub_plafon']/xs:annotation/xs:documentation[1]"/>
            
            <let name="desc_cas_baza_0115"
                value="$schema//xs:attribute[@name='cas_baza']/xs:annotation/xs:documentation[1]"/>
            
            <!-- statut pe radacina -->
            <let name="has_statut_0115" value="exists(@statut)"/>
            <let name="v_statut_0115"   value="normalize-space(string(@statut))"/>
            
            <!-- conditie statut: lipsa => TRUE, altfel NOT IN (1,2,5) -->
            <let name="cond_statut_0115"
                value="not($has_statut_0115)
                or not($v_statut_0115 = '1' or $v_statut_0115 = '2' or $v_statut_0115 = '5')"/>
            
            <!-- bifa_cas_sub_plafon pe radacina (fallback 0) -->
            <let name="v_bifa_sub_0115" value="normalize-space(string(@bifa_cas_sub_plafon))"/>
            <let name="cond_bifa_0115"  value="$v_bifa_sub_0115 = '1'"/>
            
            <!-- luam primul oblig_realizat (indiferent de prefix) -->
            <let name="obl_0115" value="(.//*[local-name()='oblig_realizat'])[1]"/>
            
            <!-- cass_total_ven_ai + cass_ven_dpi (fallback 0 daca lipsesc) -->
            <let name="v_ai_0115"  value="normalize-space(string($obl_0115/@cass_total_ven_ai))"/>
            <let name="v_dpi_0115" value="normalize-space(string($obl_0115/@cass_ven_dpi))"/>
            
            <let name="n_ai_0115"  value="if ($v_ai_0115  != '') then number($v_ai_0115)  else 0"/>
            <let name="n_dpi_0115" value="if ($v_dpi_0115 != '') then number($v_dpi_0115) else 0"/>
            
            <let name="ai_is_numeric_0115"  value="not($n_ai_0115  != $n_ai_0115)"/>
            <let name="dpi_is_numeric_0115" value="not($n_dpi_0115 != $n_dpi_0115)"/>
            
            <let name="cond_prag_0115"
                value="$ai_is_numeric_0115 and $dpi_is_numeric_0115
                and (($n_ai_0115 + $n_dpi_0115) &gt;= 48600)"/>
            
            <!-- cas_baza: tot pe oblig_realizat -->
            <let name="has_cas_baza_0115"
                value="exists($obl_0115/@cas_baza)
                and normalize-space(string($obl_0115/@cas_baza)) != ''"/>
            
            <!-- conditia finala IF ... THEN ... -->
            <let name="need_cas_baza_0115"
                value="$cond_statut_0115 and ($cond_prag_0115 or $cond_bifa_0115)"/>
            
            <let name="isValid_0115"
                value="not($need_cas_baza_0115) or $has_cas_baza_0115"/>
            
            <assert test="$isValid_0115" flag="fatal" id="BR-D212-0115">
                [BR-D212-0115]
                Daca atributul
                <value-of select="if (normalize-space($desc_statut_0115)!='') then $desc_statut_0115 else 'statut'"/>
                (statut)
                NU exista sau NU este in lista (1,2,5)
                si
                (
                (
                <value-of select="if (normalize-space($desc_cass_ai_0115)!='') then $desc_cass_ai_0115 else 'cass_total_ven_ai'"/>
                (cass_total_ven_ai)
                +
                <value-of select="if (normalize-space($desc_cass_dpi_0115)!='') then $desc_cass_dpi_0115 else 'cass_ven_dpi'"/>
                (cass_ven_dpi)
                ) este &gt;= 48600
                sau
                <value-of select="if (normalize-space($desc_bifa_sub_0115)!='') then $desc_bifa_sub_0115 else 'bifa_cas_sub_plafon'"/>
                (bifa_cas_sub_plafon) = 1
                ),
                atunci atributul
                <value-of select="if (normalize-space($desc_cas_baza_0115)!='') then $desc_cas_baza_0115 else 'cas_baza'"/>
                (cas_baza)
                din elementul oblig_realizat
                trebuie sa fie prezent.
            </assert>
            
        
        
            
        
        
            
        
        
            
        
        
        <!-- [BR-D212-0049]: cas_datorat = round(cas_baza * 25/100) -->
        <let name="n_cas_datorat_0049"
            value="number(normalize-space(string($obl_realizat/@cas_datorat)))"/>
        <let name="exp_cas_datorat_0049"
            value="round($n_cas_baza_0047 * 25 div 100)"/>

        <let name="isValid_0049"
            value="not($bifa131_root='1')
                  or
                  ( $has_cas_baza_0046 and $has_cas_datorat_0048 and $n_cas_datorat_0049 = $exp_cas_datorat_0049 )"/>

        <assert test="$isValid_0049"
            flag="fatal"
            id="BR-D212-0049">
            [BR-D212-0049]
            Atributul
            <value-of select="
                if (normalize-space($desc_cas_datorat_0048)!='')
                then $desc_cas_datorat_0048
                else 'cas_datorat'
                "/>
            (cas_datorat)
            din elementul <value-of select="name($obl_realizat)"/>
            trebuie sa fie egal cu round(cas_baza × 25 / 100).
            Valoare asteptata: <value-of select="$exp_cas_datorat_0049"/>.
        </assert>

        <!-- [BR-D212-0050]: IF (cas_retinut_platitor exists) THEN cas_retinut_platitor <= cas_datorat -->
        <let name="n_cas_retinut_0050"
            value="number(normalize-space(string($obl_realizat/@cas_retinut_platitor)))"/>

        <let name="isValid_0050"
            value="not($has_cas_retinut_0050) or ($n_cas_retinut_0050 &lt;= $n_cas_datorat_0049)"/>

        <assert test="$isValid_0050"
            flag="fatal"
            id="BR-D212-0050">
            [BR-D212-0050]
            Daca atributul
            <value-of select="
                if (normalize-space($desc_cas_retinut_0050)!='')
                then $desc_cas_retinut_0050
                else 'cas_retinut_platitor'
                "/>
            (cas_retinut_platitor)
            este completat in elementul <value-of select="name($obl_realizat)"/>,
            atunci trebuie sa fie &lt;= cas_datorat.
        </assert>

        <!-- [BR-D212-0051]: IF (cas_retinut_platitor exists) THEN cas_retinut_platitor <= 24300 -->
        <let name="isValid_0051"
            value="not($has_cas_retinut_0050) or ($n_cas_retinut_0050 &lt;= 24300)"/>

        <assert test="$isValid_0051"
            flag="fatal"
            id="BR-D212-0051">
            [BR-D212-0051]
            Daca atributul
            <value-of select="
                if (normalize-space($desc_cas_retinut_0050)!='')
                then $desc_cas_retinut_0050
                else 'cas_retinut_platitor'
                "/>
            (cas_retinut_platitor)
            este completat in elementul <value-of select="name($obl_realizat)"/>,
            atunci trebuie sa fie &lt;= 24300.
        </assert>

        <!-- [BR-D212-0052]: IF bifa131==1 THEN cas_dif_plus exists -->
        <let name="isValid_0052"
            value="not($bifa131_root='1') or $has_cas_dif_plus_0052"/>

        <assert test="$isValid_0052"
            flag="fatal"
            id="BR-D212-0052">
            [BR-D212-0052]
            Daca bifa131 are valoarea 1 din elementul <value-of select="name(.)"/>,
            atunci atributul
            <value-of select="
                if (normalize-space($desc_cas_dif_plus_0052)!='')
                then $desc_cas_dif_plus_0052
                else 'cas_dif_plus'
                "/>
            (cas_dif_plus)
            din elementul <value-of select="name($obl_realizat)"/>
            trebuie sa fie completat.
        </assert>

        <!-- [BR-D212-0053]: cas_dif_plus = cas_datorat - cas_retinut_platitor (daca lipseste retinut => 0) -->
        <let name="retinut_or_0_0053"
            value="number($has_cas_retinut_0050) * $n_cas_retinut_0050"/>
        <let name="n_cas_dif_plus_0053"
            value="number(normalize-space(string($obl_realizat/@cas_dif_plus)))"/>
        <let name="exp_cas_dif_plus_0053"
            value="$n_cas_datorat_0049 - $retinut_or_0_0053"/>

        <let name="isValid_0053"
            value="not($bifa131_root='1')
                  or
                  ( $has_cas_datorat_0048 and $has_cas_dif_plus_0052 and $n_cas_dif_plus_0053 = $exp_cas_dif_plus_0053 )"/>

        <assert test="$isValid_0053"
            flag="fatal"
            id="BR-D212-0053">
            [BR-D212-0053]
            Atributul
            <value-of select="
                if (normalize-space($desc_cas_dif_plus_0052)!='')
                then $desc_cas_dif_plus_0052
                else 'cas_dif_plus'
                "/>
            (cas_dif_plus)
            din elementul <value-of select="name($obl_realizat)"/>
            trebuie sa fie egal cu:
            cas_datorat - cas_retinut_platitor (iar daca cas_retinut_platitor nu este completat, se considera 0).
            Valoare asteptata: <value-of select="$exp_cas_dif_plus_0053"/>.
        </assert>
     
        <!-- =============================================================== -->
        <!-- BR-D212-0054: bifa132=1 => bifa_cass_datorat_ai trebuie sa existe -->
        <!-- =============================================================== -->
        
        <let name="desc_bifa_cass_ai_0054"
            value="$schema//xs:attribute[@name='bifa_cass_datorat_ai']
            /xs:annotation/xs:documentation[1]"/>
        
        <let name="bifa_cass_ai_val_0054"
            value="normalize-space(string($obl_realizat/@bifa_cass_datorat_ai))"/>
        
        <let name="has_bifa_cass_ai_0054"
            value="exists($obl_realizat/@bifa_cass_datorat_ai)
            and string-length($bifa_cass_ai_val_0054) &gt; 0"/>
        
        <let name="isValid_0054"
            value="not($bifa132_root = '1') or $has_bifa_cass_ai_0054"/>
        
        <assert test="$isValid_0054"
            flag="fatal"
            id="BR-D212-0054">
            [BR-D212-0054]
            Daca bifa132 are valoarea 1, atributul
            <value-of select="
                if (normalize-space($desc_bifa_cass_ai_0054) != '')
                then $desc_bifa_cass_ai_0054
                else 'bifa_cass_datorat_ai'
                "/>
            (bifa_cass_datorat_ai)
            din elementul <value-of select="name($obl_realizat)"/>
            trebuie sa existe (sa fie prezent).
        </assert>
        
        
        <!-- ================================================================ -->
        <!-- BR-D212-0055: bifa132=1 => bifa_cass_datorat_dpi trebuie sa existe -->
        <!-- ================================================================ -->
        
        <let name="desc_bifa_cass_dpi_0055"
            value="$schema//xs:attribute[@name='bifa_cass_datorat_dpi']
            /xs:annotation/xs:documentation[1]"/>
        
        <let name="bifa_cass_dpi_val_0055"
            value="normalize-space(string($obl_realizat/@bifa_cass_datorat_dpi))"/>
        
        <let name="has_bifa_cass_dpi_0055"
            value="exists($obl_realizat/@bifa_cass_datorat_dpi)
            and string-length($bifa_cass_dpi_val_0055) &gt; 0"/>
        
        <let name="isValid_0055"
            value="not($bifa132_root = '1') or $has_bifa_cass_dpi_0055"/>
        
        <assert test="$isValid_0055"
            flag="fatal"
            id="BR-D212-0055">
            [BR-D212-0055]
            Daca bifa132 are valoarea 1, atributul
            <value-of select="
                if (normalize-space($desc_bifa_cass_dpi_0055) != '')
                then $desc_bifa_cass_dpi_0055
                else 'bifa_cass_datorat_dpi'
                "/>
            (bifa_cass_datorat_dpi)
            din elementul <value-of select="name($obl_realizat)"/>
            trebuie sa existe (sa fie prezent).
        </assert>
        <!-- =================================================================== -->
        <!-- BR-D212-0056: bifa_cass_datorat_ai = 1 <=> cass_total_ven_ai exista, poate fi zero -->
        <!-- =================================================================== -->
        
        <!-- descrieri XSD -->
        <let name="desc_bifa_cass_ai_0056"
            value="$schema//xs:attribute[@name='bifa_cass_datorat_ai']
            /xs:annotation/xs:documentation[1]"/>
        
        <let name="desc_cass_total_ai_0056"
            value="$schema//xs:attribute[@name='cass_total_ven_ai']
            /xs:annotation/xs:documentation[1]"/>
        
        <!-- valori -->
        <let name="bifa_cass_ai_val_0056"
            value="normalize-space(string($obl_realizat/@bifa_cass_datorat_ai))"/>
        
        <let name="has_cass_total_ai_0056"
            value="exists($obl_realizat/@cass_total_ven_ai)
            and number($obl_realizat/@cass_total_ven_ai) &gt; 0" />
        
        <!-- regula de echivalenta -->
        <let name="isValid_0056"
            value="
            ($bifa_cass_ai_val_0056 = '1' and $has_cass_total_ai_0056)
            or
            ($bifa_cass_ai_val_0056 != '1' and not($has_cass_total_ai_0056))
            "/>
        
        <assert test="$isValid_0056"
            flag="fatal"
            id="BR-D212-0056">
            [BR-D212-0056]
            Atributele
            <value-of select="
                if (normalize-space($desc_bifa_cass_ai_0056) != '')
                then $desc_bifa_cass_ai_0056
                else 'bifa_cass_datorat_ai'
                "/>
            (bifa_cass_datorat_ai)
            si
            <value-of select="
                if (normalize-space($desc_cass_total_ai_0056) != '')
                then $desc_cass_total_ai_0056
                else 'cass_total_ven_ai'
                "/>
            (cass_total_ven_ai)
            din elementul <value-of select="name($obl_realizat)"/>
            trebuie corelate astfel:
            daca bifa_cass_datorat_ai are valoarea 1,
            atunci cass_total_ven_ai trebuie sa existe,
            iar daca cass_total_ven_ai exista,
            atunci bifa_cass_datorat_ai trebuie sa aiba valoarea 1.
        </assert>
        <!-- =================================================================== -->
        <!-- BR-D212-0057: bifa_cass_datorat_ai = 1 <=> baza_cass_datorat_ai exista, poate fi zero -->
        <!-- =================================================================== -->
        
        <!-- descrieri XSD -->
        <let name="desc_bifa_cass_ai_0057"
            value="$schema//xs:attribute[@name='bifa_cass_datorat_ai']
            /xs:annotation/xs:documentation[1]"/>
        
        <let name="desc_baza_cass_ai_0057"
            value="$schema//xs:attribute[@name='baza_cass_datorat_ai']
            /xs:annotation/xs:documentation[1]"/>
        
        <!-- valori -->
        <let name="bifa_cass_ai_val_0057"
            value="normalize-space(string($obl_realizat/@bifa_cass_datorat_ai))"/>
        
        <let name="has_baza_cass_ai_0057"
            value="exists($obl_realizat/@baza_cass_datorat_ai)
            and number($obl_realizat/@baza_cass_datorat_ai) &gt; 0"/>
        
        <!-- echivalenta -->
        <let name="isValid_0057"
            value="
            ($bifa_cass_ai_val_0057 = '1' and $has_baza_cass_ai_0057)
            or
            ($bifa_cass_ai_val_0057 != '1' and not($has_baza_cass_ai_0057))
            "/>
        
        <assert test="$isValid_0057"
            flag="fatal"
            id="BR-D212-0057">
            [BR-D212-0057]
            Atributele
            <value-of select="
                if (normalize-space($desc_bifa_cass_ai_0057) != '')
                then $desc_bifa_cass_ai_0057
                else 'bifa_cass_datorat_ai'
                "/>
            (bifa_cass_datorat_ai)
            si
            <value-of select="
                if (normalize-space($desc_baza_cass_ai_0057) != '')
                then $desc_baza_cass_ai_0057
                else 'baza_cass_datorat_ai'
                "/>
            (baza_cass_datorat_ai)
            din elementul <value-of select="name($obl_realizat)"/>
            trebuie corelate astfel:
            daca bifa_cass_datorat_ai are valoarea 1,
            atunci baza_cass_datorat_ai trebuie sa existe,
            iar daca baza_cass_datorat_ai exista,
            atunci bifa_cass_datorat_ai trebuie sa aiba valoarea 1.
        </assert>
        
        <!-- =============================================================== -->
        <!-- BR-D212-0058: baza_cass_datorat_ai <= 243000 (60 x SMB)          -->
        <!-- =============================================================== -->
        
        <!-- descriere XSD -->
        <let name="desc_baza_cass_ai_0058"
            value="$schema//xs:attribute[@name='baza_cass_datorat_ai']
            /xs:annotation/xs:documentation[1]"/>
        
        <!-- valoare -->
        <let name="baza_cass_ai_val_0058"
            value="number(normalize-space(string($obl_realizat/@baza_cass_datorat_ai)))"/>
        
        <!-- validare: doar daca exista -->
        <let name="isValid_0058"
            value="not(exists($obl_realizat/@baza_cass_datorat_ai))
            or
            ($baza_cass_ai_val_0058 &lt;= 243000)"/>
        
        <assert test="$isValid_0058"
            flag="fatal"
            id="BR-D212-0058">
            [BR-D212-0058]
            <value-of select="
                if (normalize-space($desc_baza_cass_ai_0058) != '')
                then $desc_baza_cass_ai_0058
                else 'baza_cass_datorat_ai'
                "/>
            (baza_cass_datorat_ai)
            din elementul <value-of select="name($obl_realizat)"/>
            nu poate depasi valoarea 243000
            (plafon maxim CASS = 60 × salariul minim brut).
        </assert>
        <!-- =============================================================== -->
        <!-- BR-D212-0059: cass_anuala_ai = round(baza_cass_datorat_ai * 10%) -->
        <!-- =============================================================== -->
        
        <!-- descrieri XSD -->
        <let name="desc_cass_ai_0059"
            value="$schema//xs:attribute[@name='cass_anuala_ai']
            /xs:annotation/xs:documentation[1]"/>
        
        <let name="desc_baza_cass_ai_0059"
            value="$schema//xs:attribute[@name='baza_cass_datorat_ai']
            /xs:annotation/xs:documentation[1]"/>
        
        <!-- valori -->
        <let name="cass_ai_val_0059"
            value="number(normalize-space(string($obl_realizat/@cass_anuala_ai)))"/>
        
        <let name="baza_cass_ai_val_0059"
            value="number(normalize-space(string($obl_realizat/@baza_cass_datorat_ai)))"/>
        
        <!-- calcul asteptat -->
        <let name="cass_expected_0059"
            value="round($baza_cass_ai_val_0059 * 10 div 100)"/>
        
        <!-- validare:
             - daca baza nu exista → nu validam
             - altfel cass_anuala_ai trebuie sa fie egal cu valoarea calculata -->
        <let name="isValid_0059"
            value="not(exists($obl_realizat/@baza_cass_datorat_ai))
            or
            ($cass_ai_val_0059 = $cass_expected_0059)"/>
        
        <assert test="$isValid_0059"
            flag="fatal"
            id="BR-D212-0059">
            [BR-D212-0059]
            <value-of select="
                if (normalize-space($desc_cass_ai_0059) != '')
                then $desc_cass_ai_0059
                else 'cass_anuala_ai'
                "/>
            (cass_anuala_ai)
            din elementul <value-of select="name($obl_realizat)"/>
            trebuie sa fie egal cu
            10% din
            <value-of select="
                if (normalize-space($desc_baza_cass_ai_0059) != '')
                then $desc_baza_cass_ai_0059
                else 'baza_cass_datorat_ai'
                "/>
            (baza_cass_datorat_ai),
            rotunjit matematic la numar intreg.
            Valoare asteptata: <value-of select="$cass_expected_0059"/>.
        </assert>
        <!-- =============================================================== -->
        <!-- BR-D212-0060: cass_datorat_ai in functie de baza si art.180     -->
        <!-- IF baza_cass_datorat_ai > 24300                                -->
        <!--    THEN cass_datorat_ai = cass_anuala_ai - cass_datorat_art180_ai
     ELSE IF exists(cass_datorat_art180_ai >= 2430)
          THEN cass_datorat_ai = 0                                  -->
        <!-- =============================================================== -->
        
        <!-- ================= -->
        <!-- Descrieri din XSD -->
        <!-- ================= -->
        <let name="desc_baza_ai_0060"
            value="$schema//xs:attribute[@name='baza_cass_datorat_ai']
            /xs:annotation/xs:documentation[1]"/>
        
        <let name="desc_anuala_ai_0060"
            value="$schema//xs:attribute[@name='cass_anuala_ai']
            /xs:annotation/xs:documentation[1]"/>
        
        <let name="desc_art180_ai_0060"
            value="$schema//xs:attribute[@name='cass_datorat_art180_ai']
            /xs:annotation/xs:documentation[1]"/>
        
        <let name="desc_datorat_ai_0060"
            value="$schema//xs:attribute[@name='cass_datorat_ai']
            /xs:annotation/xs:documentation[1]"/>
        
        <!-- ======================= -->
        <!-- Existență atribute (AI) -->
        <!-- ======================= -->
        <let name="has_baza_ai_0060"
            value="exists($obl_realizat/@baza_cass_datorat_ai)"/>
        
        <let name="has_anuala_ai_0060"
            value="exists($obl_realizat/@cass_anuala_ai)"/>
        
        <let name="has_art180_ai_0060"
            value="exists($obl_realizat/@cass_datorat_art180_ai)"/>
        
        <let name="has_datorat_ai_0060"
            value="exists($obl_realizat/@cass_datorat_ai)"/>
        
        <!-- ================= -->
        <!-- Valori numerice  -->
        <!-- ================= -->
        <let name="baza_ai_0060"
            value="number($obl_realizat/@baza_cass_datorat_ai)"/>
        
        <let name="anuala_ai_0060"
            value="number($obl_realizat/@cass_anuala_ai)"/>
        
        <let name="art180_ai_0060"
            value="number($obl_realizat/@cass_datorat_art180_ai)"/>
        
        <let name="datorat_ai_0060"
            value="number($obl_realizat/@cass_datorat_ai)"/>
        
        <!-- ================= -->
        <!-- Condiții logice  -->
        <!-- ================= -->
        
        <!-- baza > 6 x SMB (24300) -->
        <let name="isOverMin_ai_0060"
            value="$has_baza_ai_0060 and ($baza_ai_0060 &gt; 24300)"/>
        
        <!-- exists(cass_datorat_art180_ai >= 2430) -->
        <let name="hasArt180GE2430_ai_0060"
            value="$has_art180_ai_0060 and ($art180_ai_0060 &gt;= 2430)"/>
        
        <!-- valoare asteptata cand baza > 24300 -->
        <let name="expected_ai_0060"
            value="round($anuala_ai_0060 - $art180_ai_0060)"/>
        
        <!-- ================= -->
        <!-- Validare finală  -->
        <!-- ================= -->
        <let name="isValid_0060"
            value="
            not($has_baza_ai_0060)
            or
            (
            $has_datorat_ai_0060
            and
            (
            (
            $isOverMin_ai_0060
            and $has_anuala_ai_0060
            and $has_art180_ai_0060
            and $datorat_ai_0060 = $expected_ai_0060
            )
            or
            (
            not($isOverMin_ai_0060)
            and $hasArt180GE2430_ai_0060
            and $datorat_ai_0060 = 0
            )
            or
            (
            not($isOverMin_ai_0060)
            and not($hasArt180GE2430_ai_0060)
            )
            )
            )
            "/>
        
        <assert test="$isValid_0060"
            flag="fatal"
            id="BR-D212-0060">
            [BR-D212-0060]
            Atributul
            <value-of select="
                if (normalize-space($desc_datorat_ai_0060)!='')
                then $desc_datorat_ai_0060
                else 'cass_datorat_ai'
                "/>
            (cass_datorat_ai)
            din elementul <value-of select="name($obl_realizat)"/>
            trebuie determinat astfel:
            daca
            <value-of select="
                if (normalize-space($desc_baza_ai_0060)!='')
                then $desc_baza_ai_0060
                else 'baza_cass_datorat_ai'
                "/>
            (baza_cass_datorat_ai) &gt; 24300,
            atunci cass_datorat_ai =
            cass_anuala_ai − cass_datorat_art180_ai.
            In caz contrar, daca exista cass_datorat_art180_ai cu valoare
            mai mare sau egala cu 2430, atunci cass_datorat_ai trebuie sa fie 0.
        </assert>
        
        <!-- ===================================================================== -->
        <!-- BR-D212-0061: cass_dif_plus_ai                                         -->
        <!-- IF (cass_datorat_ai - cass_retinut_platitor_alin6_ai) > 0             -->
        <!-- THEN cass_dif_plus_ai = diferenta                                     -->
        <!-- ELSE cass_dif_plus_ai = 0                                              -->
        <!-- FARA NaN                                                              -->
        <!-- ===================================================================== -->
        
        <!-- descrieri XSD -->
        <let name="desc_cass_datorat_ai_0061"
            value="$schema//xs:attribute[@name='cass_datorat_ai']
            /xs:annotation/xs:documentation[1]"/>
        
        <let name="desc_cass_retinut_ai_0061"
            value="$schema//xs:attribute[@name='cass_retinut_platitor_alin6_ai']
            /xs:annotation/xs:documentation[1]"/>
        
        <let name="desc_cass_dif_plus_ai_0061"
            value="$schema//xs:attribute[@name='cass_dif_plus_ai']
            /xs:annotation/xs:documentation[1]"/>
        
        <!-- valori brute -->
        <let name="cass_datorat_raw_0061"
            value="normalize-space(string($obl_realizat/@cass_datorat_ai))"/>
        
        <let name="cass_retinut_raw_0061"
            value="normalize-space(string($obl_realizat/@cass_retinut_platitor_alin6_ai))"/>
        
        <let name="cass_dif_plus_raw_0061"
            value="normalize-space(string($obl_realizat/@cass_dif_plus_ai))"/>
        
        <!-- existenta -->
        <let name="hasCassDatorat_0061" value="$cass_datorat_raw_0061 != ''"/>
        <let name="hasCassRetinut_0061" value="$cass_retinut_raw_0061 != ''"/>
        <let name="hasCassDifPlus_0061" value="$cass_dif_plus_raw_0061 != ''"/>
        
        <!-- numeric -->
        <let name="isNumCassDatorat_0061" value="matches($cass_datorat_raw_0061, '^[0-9]+$')"/>
        <let name="isNumCassRetinut_0061" value="matches($cass_retinut_raw_0061, '^[0-9]+$')"/>
        <let name="isNumCassDifPlus_0061" value="matches($cass_dif_plus_raw_0061, '^[0-9]+$')"/>
        
        <!-- conversii sigure -->
        <let name="cass_datorat_0061" value="number($cass_datorat_raw_0061)"/>
        <let name="cass_retinut_0061" value="number($cass_retinut_raw_0061)"/>
        <let name="cass_dif_plus_0061" value="number($cass_dif_plus_raw_0061)"/>
        
        <!-- putem calcula diferenta? -->
        <let name="canCalcDiff_0061"
            value="$hasCassDatorat_0061 and $hasCassRetinut_0061
            and $isNumCassDatorat_0061 and $isNumCassRetinut_0061"/>
        
        <let name="diff_0061"
            value="$cass_datorat_0061 - $cass_retinut_0061"/>
        
        <!-- validare -->
        <let name="isValid_0061"
            value="not($canCalcDiff_0061)
            or
            (
            $hasCassDifPlus_0061
            and $isNumCassDifPlus_0061
            and
            (
            ($diff_0061 &gt; 0 and $cass_dif_plus_0061 = $diff_0061)
            or
            ($diff_0061 &lt;= 0 and $cass_dif_plus_0061 = 0)
            )
            )"/>
        
        <assert test="$isValid_0061"
            flag="fatal"
            id="BR-D212-0061">
            [BR-D212-0061]
            <value-of select="
                if (normalize-space($desc_cass_dif_plus_ai_0061) != '')
                then $desc_cass_dif_plus_ai_0061
                else 'cass_dif_plus_ai'
                "/>
            (cass_dif_plus_ai)
            din elementul <value-of select="name($obl_realizat)"/>
            trebuie calculat astfel:
            daca
            <value-of select="
                if (normalize-space($desc_cass_datorat_ai_0061) != '')
                then $desc_cass_datorat_ai_0061
                else 'cass_datorat_ai'
                "/>
            minus
            <value-of select="
                if (normalize-space($desc_cass_retinut_ai_0061) != '')
                then $desc_cass_retinut_ai_0061
                else 'cass_retinut_platitor_alin6_ai'
                "/>
            este mai mare decat 0,
            atunci (cass_dif_plus_ai) este egal cu diferenta,
            iar in caz contrar trebuie sa fie 0.
        </assert>
        <!-- ===================================================================== -->
        <!-- BR-D212-0062: cass_dif_minus6_ai                                       -->
        <!-- IF (cass_datorat_ai - cass_retinut_platitor_alin6_ai) < 0             -->
        <!-- THEN cass_dif_minus6_ai = cass_retinut_platitor_alin6_ai - cass_datorat_ai -->
        <!-- ELSE cass_dif_minus6_ai = 0                                           -->
        <!-- FARA NaN                                                              -->
        <!-- ===================================================================== -->
        
        <!-- descrieri XSD -->
        <let name="desc_cass_datorat_ai_0062"
            value="$schema//xs:attribute[@name='cass_datorat_ai']
            /xs:annotation/xs:documentation[1]"/>
        
        <let name="desc_cass_retinut_ai_0062"
            value="$schema//xs:attribute[@name='cass_retinut_platitor_alin6_ai']
            /xs:annotation/xs:documentation[1]"/>
        
        <let name="desc_cass_dif_minus6_ai_0062"
            value="$schema//xs:attribute[@name='cass_dif_minus6_ai']
            /xs:annotation/xs:documentation[1]"/>
        
        <!-- valori brute -->
        <let name="cass_datorat_raw_0062"
            value="normalize-space(string($obl_realizat/@cass_datorat_ai))"/>
        
        <let name="cass_retinut_raw_0062"
            value="normalize-space(string($obl_realizat/@cass_retinut_platitor_alin6_ai))"/>
        
        <let name="cass_dif_minus_raw_0062"
            value="normalize-space(string($obl_realizat/@cass_dif_minus6_ai))"/>
        
        <!-- existenta -->
        <let name="hasCassDatorat_0062" value="$cass_datorat_raw_0062 != ''"/>
        <let name="hasCassRetinut_0062" value="$cass_retinut_raw_0062 != ''"/>
        <let name="hasCassDifMinus_0062" value="$cass_dif_minus_raw_0062 != ''"/>
        
        <!-- numeric -->
        <let name="isNumCassDatorat_0062" value="matches($cass_datorat_raw_0062, '^[0-9]+$')"/>
        <let name="isNumCassRetinut_0062" value="matches($cass_retinut_raw_0062, '^[0-9]+$')"/>
        <let name="isNumCassDifMinus_0062" value="matches($cass_dif_minus_raw_0062, '^[0-9]+$')"/>
        
        <!-- conversii sigure -->
        <let name="cass_datorat_0062" value="number($cass_datorat_raw_0062)"/>
        <let name="cass_retinut_0062" value="number($cass_retinut_raw_0062)"/>
        <let name="cass_dif_minus_0062" value="number($cass_dif_minus_raw_0062)"/>
        
        <!-- putem calcula diferenta? -->
        <let name="canCalcDiff_0062"
            value="$hasCassDatorat_0062 and $hasCassRetinut_0062
            and $isNumCassDatorat_0062 and $isNumCassRetinut_0062"/>
        
        <let name="diff_0062"
            value="$cass_datorat_0062 - $cass_retinut_0062"/>
        
        <!-- validare -->
        <let name="isValid_0062"
            value="not($canCalcDiff_0062)
            or
            (
            $hasCassDifMinus_0062
            and $isNumCassDifMinus_0062
            and
            (
            ($diff_0062 &lt; 0 and $cass_dif_minus_0062 = ($cass_retinut_0062 - $cass_datorat_0062))
            or
            ($diff_0062 &gt;= 0 and $cass_dif_minus_0062 = 0)
            )
            )"/>
        
        <assert test="$isValid_0062"
            flag="fatal"
            id="BR-D212-0062">
            [BR-D212-0062]
            <value-of select="
                if (normalize-space($desc_cass_dif_minus6_ai_0062) != '')
                then $desc_cass_dif_minus6_ai_0062
                else 'cass_dif_minus6_ai'
                "/>
            (cass_dif_minus6_ai)
            din elementul <value-of select="name($obl_realizat)"/>
            trebuie calculat astfel:
            daca
            <value-of select="
                if (normalize-space($desc_cass_datorat_ai_0062) != '')
                then $desc_cass_datorat_ai_0062
                else 'cass_datorat_ai'
                "/>
            minus
            <value-of select="
                if (normalize-space($desc_cass_retinut_ai_0062) != '')
                then $desc_cass_retinut_ai_0062
                else 'cass_retinut_platitor_alin6_ai'
                "/>
            este mai mic decat 0,
            atunci (cass_dif_minus6_ai) este egal cu
            (cass_retinut_platitor_alin6_ai - cass_datorat_ai),
            iar in caz contrar trebuie sa fie 0.
        </assert>
        <!-- ===================================================================== -->
        <!-- BR-D212-0063: IF bifa_cass_datorat_dpi = 1 THEN bifa_cass_real exists  -->
        <!-- ===================================================================== -->
        
        <!-- descrieri XSD -->
        <let name="desc_bifa_cass_dpi_0063"
            value="$schema//xs:attribute[@name='bifa_cass_datorat_dpi']
            /xs:annotation/xs:documentation[1]"/>
        
        <let name="desc_bifa_cass_real_0063"
            value="$schema//xs:attribute[@name='bifa_cass_real']
            /xs:annotation/xs:documentation[1]"/>
        
        <!-- valori normalizate -->
        <let name="bifa_cass_dpi_val_0063"
            value="normalize-space(string($obl_realizat/@bifa_cass_datorat_dpi))"/>
        
        <let name="has_bifa_cass_real_0063"
            value="exists($obl_realizat/@bifa_cass_real)"/>
        
        <!-- regula -->
        <let name="isValid_0063"
            value="not($bifa132_root = '1')
            or
            ($bifa_cass_dpi_val_0063 != '1')
            or
            $has_bifa_cass_real_0063"/>
        
        <assert test="$isValid_0063"
            flag="fatal"
            id="BR-D212-0063">
            [BR-D212-0063]
            Daca
            <value-of select="
                if (normalize-space($desc_bifa_cass_dpi_0063) != '')
                then $desc_bifa_cass_dpi_0063
                else 'bifa_cass_datorat_dpi'
                "/>
            (bifa_cass_datorat_dpi)
            are valoarea 1, atunci atributul
            <value-of select="
                if (normalize-space($desc_bifa_cass_real_0063) != '')
                then $desc_bifa_cass_real_0063
                else 'bifa_cass_real'
                "/>
            (bifa_cass_real)
            trebuie sa existe
            in elementul <value-of select="name($obl_realizat)"/>.
        </assert>
        <!-- ===================================================================== -->
        <!-- BR-D212-0064: IF bifa_cass_real exists THEN cass_ven_dpi exists        -->
        <!-- ===================================================================== -->
        
        <!-- descrieri XSD -->
        <let name="desc_bifa_cass_real_0064"
            value="$schema//xs:attribute[@name='bifa_cass_real']
            /xs:annotation/xs:documentation[1]"/>
        
        <let name="desc_cass_ven_dpi_0064"
            value="$schema//xs:attribute[@name='cass_ven_dpi']
            /xs:annotation/xs:documentation[1]"/>
        
        <!-- conditii existenta -->
        <let name="has_bifa_cass_real_0064"
            value="exists($obl_realizat/@bifa_cass_real)"/>
        
        <let name="has_cass_ven_dpi_0064"
            value="exists($obl_realizat/@cass_ven_dpi)"/>
        
        <!-- regula -->
        <let name="isValid_0064"
            value="not($has_bifa_cass_real_0064) or $has_cass_ven_dpi_0064"/>
        
        <assert test="$isValid_0064"
            flag="fatal"
            id="BR-D212-0064">
            [BR-D212-0064]
            Daca atributul
            <value-of select="
                if (normalize-space($desc_bifa_cass_real_0064) != '')
                then $desc_bifa_cass_real_0064
                else 'bifa_cass_real'
                "/>
            (bifa_cass_real)
            exista in elementul <value-of select="name($obl_realizat)"/>,
            atunci atributul
            <value-of select="
                if (normalize-space($desc_cass_ven_dpi_0064) != '')
                then $desc_cass_ven_dpi_0064
                else 'cass_ven_dpi'
                "/>
            (cass_ven_dpi)
            trebuie sa existe in acelasi element.
        </assert>
        
        
        <!-- ===================================================================== -->
        <!-- BR-D212-0065: IF bifa_cass_real exists THEN cass_ven_asc exists        -->
        <!-- ===================================================================== -->
        
        <let name="desc_cass_ven_asc_0065"
            value="$schema//xs:attribute[@name='cass_ven_asc']
            /xs:annotation/xs:documentation[1]"/>
        
        <let name="has_cass_ven_asc_0065"
            value="exists($obl_realizat/@cass_ven_asc)"/>
        
        <let name="isValid_0065"
            value="not(exists($obl_realizat/@bifa_cass_real)) or $has_cass_ven_asc_0065"/>
        
        <assert test="$isValid_0065"
            flag="fatal"
            id="BR-D212-0065">
            [BR-D212-0065]
            Daca atributul
            <value-of select="
                if (normalize-space($desc_bifa_cass_real_0064) != '')
                then $desc_bifa_cass_real_0064
                else 'bifa_cass_real'
                "/>
            (bifa_cass_real)
            exista in elementul <value-of select="name($obl_realizat)"/>,
            atunci atributul
            <value-of select="
                if (normalize-space($desc_cass_ven_asc_0065) != '')
                then $desc_cass_ven_asc_0065
                else 'cass_ven_asc'
                "/>
            (cass_ven_asc)
            trebuie sa existe in acelasi element.
        </assert>
        
        
        <!-- ===================================================================== -->
        <!-- BR-D212-0066: IF bifa_cass_real exists THEN cass_ven_cfb exists        -->
        <!-- ===================================================================== -->
        
        <let name="desc_cass_ven_cfb_0066"
            value="$schema//xs:attribute[@name='cass_ven_cfb']
            /xs:annotation/xs:documentation[1]"/>
        
        <let name="has_cass_ven_cfb_0066"
            value="exists($obl_realizat/@cass_ven_cfb)"/>
        
        <let name="isValid_0066"
            value="not(exists($obl_realizat/@bifa_cass_real)) or $has_cass_ven_cfb_0066"/>
        
        <assert test="$isValid_0066"
            flag="fatal"
            id="BR-D212-0066">
            [BR-D212-0066]
            Daca atributul
            <value-of select="
                if (normalize-space($desc_bifa_cass_real_0064) != '')
                then $desc_bifa_cass_real_0064
                else 'bifa_cass_real'
                "/>
            (bifa_cass_real)
            exista in elementul <value-of select="name($obl_realizat)"/>,
            atunci atributul
            <value-of select="
                if (normalize-space($desc_cass_ven_cfb_0066) != '')
                then $desc_cass_ven_cfb_0066
                else 'cass_ven_cfb'
                "/>
            (cass_ven_cfb)
            trebuie sa existe in acelasi element.
        </assert>
        
        
        <!-- ===================================================================== -->
        <!-- BR-D212-0067: IF bifa_cass_real exists THEN cass_ven_inv exists        -->
        <!-- ===================================================================== -->
        
        <let name="desc_cass_ven_inv_0067"
            value="$schema//xs:attribute[@name='cass_ven_inv']
            /xs:annotation/xs:documentation[1]"/>
        
        <let name="has_cass_ven_inv_0067"
            value="exists($obl_realizat/@cass_ven_inv)"/>
        
        <let name="isValid_0067"
            value="not(exists($obl_realizat/@bifa_cass_real)) or $has_cass_ven_inv_0067"/>
        
        <assert test="$isValid_0067"
            flag="fatal"
            id="BR-D212-0067">
            [BR-D212-0067]
            Daca atributul
            <value-of select="
                if (normalize-space($desc_bifa_cass_real_0064) != '')
                then $desc_bifa_cass_real_0064
                else 'bifa_cass_real'
                "/>
            (bifa_cass_real)
            exista in elementul <value-of select="name($obl_realizat)"/>,
            atunci atributul
            <value-of select="
                if (normalize-space($desc_cass_ven_inv_0067) != '')
                then $desc_cass_ven_inv_0067
                else 'cass_ven_inv'
                "/>
            (cass_ven_inv)
            trebuie sa existe in acelasi element.
        </assert>
        
        
        <!-- ===================================================================== -->
        <!-- BR-D212-0068: IF bifa_cass_real exists THEN cass_ven_asp exists        -->
        <!-- ===================================================================== -->
        
        <let name="desc_cass_ven_asp_0068"
            value="$schema//xs:attribute[@name='cass_ven_asp']
            /xs:annotation/xs:documentation[1]"/>
        
        <let name="has_cass_ven_asp_0068"
            value="exists($obl_realizat/@cass_ven_asp)"/>
        
        <let name="isValid_0068"
            value="not(exists($obl_realizat/@bifa_cass_real)) or $has_cass_ven_asp_0068"/>
        
        <assert test="$isValid_0068"
            flag="fatal"
            id="BR-D212-0068">
            [BR-D212-0068]
            Daca atributul
            <value-of select="
                if (normalize-space($desc_bifa_cass_real_0064) != '')
                then $desc_bifa_cass_real_0064
                else 'bifa_cass_real'
                "/>
            (bifa_cass_real)
            exista in elementul <value-of select="name($obl_realizat)"/>,
            atunci atributul
            <value-of select="
                if (normalize-space($desc_cass_ven_asp_0068) != '')
                then $desc_cass_ven_asp_0068
                else 'cass_ven_asp'
                "/>
            (cass_ven_asp)
            trebuie sa existe in acelasi element.
        </assert>
        
        
        <!-- ===================================================================== -->
        <!-- BR-D212-0069: IF bifa_cass_real exists THEN cass_ven_alt exists        -->
        <!-- ===================================================================== -->
        
        <let name="desc_cass_ven_alt_0069"
            value="$schema//xs:attribute[@name='cass_ven_alt']
            /xs:annotation/xs:documentation[1]"/>
        
        <let name="has_cass_ven_alt_0069"
            value="exists($obl_realizat/@cass_ven_alt)"/>
        
        <let name="isValid_0069"
            value="not(exists($obl_realizat/@bifa_cass_real)) or $has_cass_ven_alt_0069"/>
        
        <assert test="$isValid_0069"
            flag="fatal"
            id="BR-D212-0069">
            [BR-D212-0069]
            Daca atributul
            <value-of select="
                if (normalize-space($desc_bifa_cass_real_0064) != '')
                then $desc_bifa_cass_real_0064
                else 'bifa_cass_real'
                "/>
            (bifa_cass_real)
            exista in elementul <value-of select="name($obl_realizat)"/>,
            atunci atributul
            <value-of select="
                if (normalize-space($desc_cass_ven_alt_0069) != '')
                then $desc_cass_ven_alt_0069
                else 'cass_ven_alt'
                "/>
            (cass_ven_alt)
            trebuie sa existe in acelasi element.
        </assert>
        <!-- ===================================================================== -->
        <!-- BR-D212-0070: cass_total_ven = suma cass_ven_*                         -->
        <!-- Cerinta: validarea se aplica DOAR daca atributele exista (cass_total_ven exista) -->
        <!--          iar componentele lipsa se considera 0                         -->
        <!-- ===================================================================== -->
        
        <!-- descrieri XSD -->
        <let name="desc_cass_total_ven_0070"
            value="$schema//xs:attribute[@name='cass_total_ven']/xs:annotation/xs:documentation[1]"/>
        
        <let name="desc_cass_ven_dpi_0070"
            value="$schema//xs:attribute[@name='cass_ven_dpi']/xs:annotation/xs:documentation[1]"/>
        
        <let name="desc_cass_ven_asc_0070"
            value="$schema//xs:attribute[@name='cass_ven_asc']/xs:annotation/xs:documentation[1]"/>
        
        <let name="desc_cass_ven_cfb_0070"
            value="$schema//xs:attribute[@name='cass_ven_cfb']/xs:annotation/xs:documentation[1]"/>
        
        <let name="desc_cass_ven_inv_0070"
            value="$schema//xs:attribute[@name='cass_ven_inv']/xs:annotation/xs:documentation[1]"/>
        
        <let name="desc_cass_ven_asp_0070"
            value="$schema//xs:attribute[@name='cass_ven_asp']/xs:annotation/xs:documentation[1]"/>
        
        <let name="desc_cass_ven_alt_0070"
            value="$schema//xs:attribute[@name='cass_ven_alt']/xs:annotation/xs:documentation[1]"/>
        
        <!-- existenta atributelor (declanseaza / nu declanseaza validarea) -->
        <let name="has_cass_total_ven_0070"
            value="exists($obl_realizat/@cass_total_ven) and normalize-space(string($obl_realizat/@cass_total_ven)) != ''"/>
        
        <!-- valori numerice (componentele lipsa => 0) -->
        <let name="cass_total_ven_val_0070"
            value="if ($has_cass_total_ven_0070)
            then number(normalize-space(string($obl_realizat/@cass_total_ven)))
            else 0"/>
        
        <let name="cass_ven_dpi_val_0070"
            value="if (exists($obl_realizat/@cass_ven_dpi) and normalize-space(string($obl_realizat/@cass_ven_dpi)) != '')
            then number(normalize-space(string($obl_realizat/@cass_ven_dpi)))
            else 0"/>
        
        <let name="cass_ven_asc_val_0070"
            value="if (exists($obl_realizat/@cass_ven_asc) and normalize-space(string($obl_realizat/@cass_ven_asc)) != '')
            then number(normalize-space(string($obl_realizat/@cass_ven_asc)))
            else 0"/>
        
        <let name="cass_ven_cfb_val_0070"
            value="if (exists($obl_realizat/@cass_ven_cfb) and normalize-space(string($obl_realizat/@cass_ven_cfb)) != '')
            then number(normalize-space(string($obl_realizat/@cass_ven_cfb)))
            else 0"/>
        
        <let name="cass_ven_inv_val_0070"
            value="if (exists($obl_realizat/@cass_ven_inv) and normalize-space(string($obl_realizat/@cass_ven_inv)) != '')
            then number(normalize-space(string($obl_realizat/@cass_ven_inv)))
            else 0"/>
        
        <let name="cass_ven_asp_val_0070"
            value="if (exists($obl_realizat/@cass_ven_asp) and normalize-space(string($obl_realizat/@cass_ven_asp)) != '')
            then number(normalize-space(string($obl_realizat/@cass_ven_asp)))
            else 0"/>
        
        <let name="cass_ven_alt_val_0070"
            value="if (exists($obl_realizat/@cass_ven_alt) and normalize-space(string($obl_realizat/@cass_ven_alt)) != '')
            then number(normalize-space(string($obl_realizat/@cass_ven_alt)))
            else 0"/>
        
        <!-- suma componentelor -->
        <let name="sum_components_0070"
            value="$cass_ven_dpi_val_0070
            + $cass_ven_asc_val_0070
            + $cass_ven_cfb_val_0070
            + $cass_ven_inv_val_0070
            + $cass_ven_asp_val_0070
            + $cass_ven_alt_val_0070"/>
        
        <!-- validare: daca cass_total_ven NU exista -> nu se valideaza (true) -->
        <let name="isValid_0070"
            value="not($has_cass_total_ven_0070) or ($cass_total_ven_val_0070 = $sum_components_0070)"/>
        
        <assert test="$isValid_0070"
            flag="fatal"
            id="BR-D212-0070">
            [BR-D212-0070]
            Atributul
            <value-of select="
                if (normalize-space(string($desc_cass_total_ven_0070)) != '')
                then $desc_cass_total_ven_0070
                else 'cass_total_ven'
                "/>
            (cass_total_ven)
            din elementul <value-of select="name($obl_realizat)"/>
            trebuie sa fie egal cu suma atributelor:
            <value-of select="
                if (normalize-space(string($desc_cass_ven_dpi_0070)) != '')
                then $desc_cass_ven_dpi_0070
                else 'cass_ven_dpi'
                "/>,
            <value-of select="
                if (normalize-space(string($desc_cass_ven_asc_0070)) != '')
                then $desc_cass_ven_asc_0070
                else 'cass_ven_asc'
                "/>,
            <value-of select="
                if (normalize-space(string($desc_cass_ven_cfb_0070)) != '')
                then $desc_cass_ven_cfb_0070
                else 'cass_ven_cfb'
                "/>,
            <value-of select="
                if (normalize-space(string($desc_cass_ven_inv_0070)) != '')
                then $desc_cass_ven_inv_0070
                else 'cass_ven_inv'
                "/>,
            <value-of select="
                if (normalize-space(string($desc_cass_ven_asp_0070)) != '')
                then $desc_cass_ven_asp_0070
                else 'cass_ven_asp'
                "/>
            si
            <value-of select="
                if (normalize-space(string($desc_cass_ven_alt_0070)) != '')
                then $desc_cass_ven_alt_0070
                else 'cass_ven_alt'
                "/>.
            (componentele lipsa se considera 0; validarea se aplica doar daca cass_total_ven exista)
        </assert>
        
        <!-- ===================================================================== -->
        <!-- BR-D212-0071: IF bifa_cass_real = 1 THEN cass_baza = 6 * 4050         -->
        <!-- ===================================================================== -->
        
        <let name="desc_bifa_cass_real_0071"
            value="$schema//xs:attribute[@name='bifa_cass_real']
            /xs:annotation/xs:documentation[1]"/>
        
        <let name="desc_cass_baza_0071"
            value="$schema//xs:attribute[@name='cass_baza']
            /xs:annotation/xs:documentation[1]"/>
        
        <let name="bifa_cass_real_val_0071"
            value="normalize-space(string($obl_realizat/@bifa_cass_real))"/>
        
        <let name="cass_baza_val_0071"
            value="number($obl_realizat/@cass_baza)"/>
        
        <let name="isValid_0071"
            value="not($bifa_cass_real_val_0071 = '1')
            or ($cass_baza_val_0071 = 24300)"/>
        
        <assert test="$isValid_0071"
            flag="fatal"
            id="BR-D212-0071">
            [BR-D212-0071]
            Daca
            <value-of select="if (normalize-space($desc_bifa_cass_real_0071)!='')
                then $desc_bifa_cass_real_0071 else 'bifa_cass_real'"/>
            (bifa_cass_real)
            din elementul <value-of select="name($obl_realizat)"/>
            are valoarea 1, atunci
            <value-of select="if (normalize-space($desc_cass_baza_0071)!='')
                then $desc_cass_baza_0071 else 'cass_baza'"/>
            (cass_baza)
            trebuie sa fie egal cu 6 * 4050 (24300).
        </assert>
        
        
        <!-- ===================================================================== -->
        <!-- BR-D212-0072: IF bifa_cass_real = 2 THEN cass_baza = 12 * 4050        -->
        <!-- ===================================================================== -->
        
        <let name="desc_bifa_cass_real_0072"
            value="$schema//xs:attribute[@name='bifa_cass_real']
            /xs:annotation/xs:documentation[1]"/>
        
        <let name="desc_cass_baza_0072"
            value="$schema//xs:attribute[@name='cass_baza']
            /xs:annotation/xs:documentation[1]"/>
        
        <let name="bifa_cass_real_val_0072"
            value="normalize-space(string($obl_realizat/@bifa_cass_real))"/>
        
        <let name="cass_baza_val_0072"
            value="number($obl_realizat/@cass_baza)"/>
        
        <let name="isValid_0072"
            value="not($bifa_cass_real_val_0072 = '2')
            or ($cass_baza_val_0072 = 48600)"/>
        
        <assert test="$isValid_0072"
            flag="fatal"
            id="BR-D212-0072">
            [BR-D212-0072]
            Daca
            <value-of select="if (normalize-space($desc_bifa_cass_real_0072)!='')
                then $desc_bifa_cass_real_0072 else 'bifa_cass_real'"/>
            (bifa_cass_real)
            din elementul <value-of select="name($obl_realizat)"/>
            are valoarea 2, atunci
            <value-of select="if (normalize-space($desc_cass_baza_0072)!='')
                then $desc_cass_baza_0072 else 'cass_baza'"/>
            (cass_baza)
            trebuie sa fie egal cu 12 * 4050 (48600).
        </assert>
        
        
        <!-- ===================================================================== -->
        <!-- BR-D212-0073: IF bifa_cass_real = 3 THEN cass_baza = 24 * 4050        -->
        <!-- ===================================================================== -->
        
        <let name="desc_bifa_cass_real_0073"
            value="$schema//xs:attribute[@name='bifa_cass_real']
            /xs:annotation/xs:documentation[1]"/>
        
        <let name="desc_cass_baza_0073"
            value="$schema//xs:attribute[@name='cass_baza']
            /xs:annotation/xs:documentation[1]"/>
        
        <let name="bifa_cass_real_val_0073"
            value="normalize-space(string($obl_realizat/@bifa_cass_real))"/>
        
        <let name="cass_baza_val_0073"
            value="number($obl_realizat/@cass_baza)"/>
        
        <let name="isValid_0073"
            value="not($bifa_cass_real_val_0073 = '3')
            or ($cass_baza_val_0073 = 97200)"/>
        
        <assert test="$isValid_0073"
            flag="fatal"
            id="BR-D212-0073">
            [BR-D212-0073]
            Daca
            <value-of select="if (normalize-space($desc_bifa_cass_real_0073)!='')
                then $desc_bifa_cass_real_0073 else 'bifa_cass_real'"/>
            (bifa_cass_real)
            din elementul <value-of select="name($obl_realizat)"/>
            are valoarea 3, atunci
            <value-of select="if (normalize-space($desc_cass_baza_0073)!='')
                then $desc_cass_baza_0073 else 'cass_baza'"/>
            (cass_baza)
            trebuie sa fie egal cu 24 * 4050 (97200).
        </assert>
        <!-- ===================================================================== -->
        <!-- BR-D212-0074: cass_anuala = round(cass_baza * 10 / 100)               -->
        <!-- ===================================================================== -->
        
        <let name="desc_cass_baza_0074"
            value="$schema//xs:attribute[@name='cass_baza']
            /xs:annotation/xs:documentation[1]"/>
        
        <let name="desc_cass_anuala_0074"
            value="$schema//xs:attribute[@name='cass_anuala']
            /xs:annotation/xs:documentation[1]"/>
        
        <let name="has_cass_baza_0074"   value="exists($obl_realizat/@cass_baza)"/>
        <let name="has_cass_anuala_0074" value="exists($obl_realizat/@cass_anuala)"/>
        
        <let name="cass_baza_val_0074"
            value="number($obl_realizat/@cass_baza)"/>
        
        <let name="cass_anuala_val_0074"
            value="number($obl_realizat/@cass_anuala)"/>
        
        <!-- round half away from zero (math.round) pentru valori pozitive -->
        <let name="cass_anuala_calc_0074"
            value="floor(($cass_baza_val_0074 * 10 div 100) + 0.5)"/>
        
        <let name="isValid_0074"
            value="not($has_cass_baza_0074)
            or (
            $has_cass_anuala_0074
            and $cass_anuala_val_0074 = $cass_anuala_calc_0074
            )"/>
        
        <assert test="$isValid_0074"
            flag="fatal"
            id="BR-D212-0074">
            [BR-D212-0074]
            Atributul
            <value-of select="if (normalize-space($desc_cass_anuala_0074)!='')
                then $desc_cass_anuala_0074 else 'cass_anuala'"/>
            (cass_anuala)
            din elementul <value-of select="name($obl_realizat)"/>
            trebuie sa fie egal cu rotunjirea la numar intreg a valorii
            <value-of select="if (normalize-space($desc_cass_baza_0074)!='')
                then $desc_cass_baza_0074 else 'cass_baza'"/>
            (cass_baza) * 10 / 100.
        </assert>
        
        
        <!-- =============================================================== -->
        <!-- BR-D212-0075: cass_datorat in functie de cass_baza si art.180   -->
        <!-- IF cass_baza > 24300 THEN cass_datorat = cass_anuala - cass_datorat_art180
     ELSE IF exists(cass_datorat_art180 >= 2430) THEN cass_datorat = 0          -->
        <!-- =============================================================== -->
        
        <!-- Descrieri XSD -->
        <let name="desc_cass_baza_0075"
            value="$schema//xs:attribute[@name='cass_baza']/xs:annotation/xs:documentation[1]"/>
        <let name="desc_cass_anuala_0075"
            value="$schema//xs:attribute[@name='cass_anuala']/xs:annotation/xs:documentation[1]"/>
        <let name="desc_cass_art180_0075"
            value="$schema//xs:attribute[@name='cass_datorat_art180']/xs:annotation/xs:documentation[1]"/>
        <let name="desc_cass_datorat_0075"
            value="$schema//xs:attribute[@name='cass_datorat']/xs:annotation/xs:documentation[1]"/>
        
        <!-- Existență atribute (fara NaN) -->
        <let name="has_cass_baza_0075"    value="exists($obl_realizat/@cass_baza)"/>
        <let name="has_cass_anuala_0075"  value="exists($obl_realizat/@cass_anuala)"/>
        <let name="has_cass_art180_0075"  value="exists($obl_realizat/@cass_datorat_art180)"/>
        <let name="has_cass_datorat_0075" value="exists($obl_realizat/@cass_datorat)"/>
        
        <!-- Valori ca string -->
        <let name="cass_baza_str_0075"    value="normalize-space(string($obl_realizat/@cass_baza))"/>
        <let name="cass_anuala_str_0075"  value="normalize-space(string($obl_realizat/@cass_anuala))"/>
        <let name="cass_art180_str_0075"  value="normalize-space(string($obl_realizat/@cass_datorat_art180))"/>
        <let name="cass_datorat_str_0075" value="normalize-space(string($obl_realizat/@cass_datorat))"/>
        
        <!-- Valori ca numere -->
        <let name="cass_baza_0075"    value="number($cass_baza_str_0075)"/>
        <let name="cass_anuala_0075"  value="number($cass_anuala_str_0075)"/>
        <let name="cass_art180_0075"  value="number($cass_art180_str_0075)"/>
        <let name="cass_datorat_0075" value="number($cass_datorat_str_0075)"/>
        
        <!-- Conditii -->
        <let name="isOverMin_0075" value="$has_cass_baza_0075 and ($cass_baza_0075 &gt; 24300)"/>
        
        <!-- ELSE IF exists(cass_datorat_art180 >= 2430) -->
        <let name="hasArt180GE2430_0075"
            value="$has_cass_art180_0075 and ($cass_art180_0075 &gt;= 2430)"/>
        
        <!-- Valoare așteptată (în ramura 1) -->
        <let name="expected_over_0075"
            value="round($cass_anuala_0075 - $cass_art180_0075)"/>
        
        <!-- Validare:
   - daca baza > 24300 => cass_datorat trebuie sa fie round(cass_anuala - cass_datorat_art180)
   - altfel, daca art180 exista si >= 2430 => cass_datorat trebuie sa fie 0
   - altfel => nu impunem o egalitate (nu validam prin aceasta regula)
-->
        <let name="isValid_0075"
            value="
            not($has_cass_baza_0075)
            or
            (
            $has_cass_datorat_0075
            and
            (
            ( $isOverMin_0075
            and $has_cass_anuala_0075
            and $has_cass_art180_0075
            and $cass_datorat_0075 = $expected_over_0075
            )
            or
            ( not($isOverMin_0075)
            and $hasArt180GE2430_0075
            and $cass_datorat_0075 = 0
            )
            or
            ( not($isOverMin_0075)
            and not($hasArt180GE2430_0075)
            )
            )
            )
            "/>
        
        <assert test="$isValid_0075" flag="fatal" id="BR-D212-0075">
            [BR-D212-0075]
            Atributul
            <value-of select="if (normalize-space($desc_cass_datorat_0075)!='') then $desc_cass_datorat_0075 else 'cass_datorat'"/>
            (cass_datorat)
            din elementul <value-of select="name($obl_realizat)"/>
            trebuie determinat astfel:
            daca
            <value-of select="if (normalize-space($desc_cass_baza_0075)!='') then $desc_cass_baza_0075 else 'cass_baza'"/>
            (cass_baza) &gt; 24300,
            atunci
            <value-of select="if (normalize-space($desc_cass_datorat_0075)!='') then $desc_cass_datorat_0075 else 'cass_datorat'"/>
            (cass_datorat)
            = round(
            <value-of select="if (normalize-space($desc_cass_anuala_0075)!='') then $desc_cass_anuala_0075 else 'cass_anuala'"/>
            (cass_anuala)
            -
            <value-of select="if (normalize-space($desc_cass_art180_0075)!='') then $desc_cass_art180_0075 else 'cass_datorat_art180'"/>
            (cass_datorat_art180)
            ).
            In caz contrar, daca exista
            <value-of select="if (normalize-space($desc_cass_art180_0075)!='') then $desc_cass_art180_0075 else 'cass_datorat_art180'"/>
            (cass_datorat_art180)
            cu valoare &gt;= 2430, atunci cass_datorat trebuie sa fie 0.
        </assert>
        <!-- ====================================================== -->
        <!-- BR-D212-0077: cass_dif_plus
     IF (cass_datorat − cass_retinut) > 0
     THEN cass_dif_plus = cass_datorat − cass_retinut
     ELSE cass_dif_plus = 0
     Principiu: validarea se aplica DOAR daca atributul tinta (cass_dif_plus) exista;
                pentru calcule, atributele lipsa (cass_datorat/cass_retinut) => 0 -->
        <!-- ====================================================== -->
        
        <!-- Descrieri din XSD -->
        <let name="desc_cass_datorat_0077"
            value="$schema//xs:attribute[@name='cass_datorat']/xs:annotation/xs:documentation[1]"/>
        
        <let name="desc_cass_retinut_0077"
            value="$schema//xs:attribute[@name='cass_retinut']/xs:annotation/xs:documentation[1]"/>
        
        <let name="desc_cass_dif_plus_0077"
            value="$schema//xs:attribute[@name='cass_dif_plus']/xs:annotation/xs:documentation[1]"/>
        
        <!-- Element oblig_realizat -->
        <let name="obl_realizat_0077"
            value="(.//d212:oblig_realizat)[1]"/>
        
        <!-- existenta atributului tinta (declanseaza / nu declanseaza validarea) -->
        <let name="has_cass_dif_plus_0077"
            value="exists($obl_realizat_0077/@cass_dif_plus) and normalize-space(string($obl_realizat_0077/@cass_dif_plus)) != ''"/>
        
        <!-- Valori numerice (fallback 0 daca lipsesc/vid) -->
        <let name="cass_datorat_0077"
            value="if (exists($obl_realizat_0077/@cass_datorat) and normalize-space(string($obl_realizat_0077/@cass_datorat)) != '')
            then number(normalize-space(string($obl_realizat_0077/@cass_datorat)))
            else 0"/>
        
        <let name="cass_retinut_0077"
            value="if (exists($obl_realizat_0077/@cass_retinut) and normalize-space(string($obl_realizat_0077/@cass_retinut)) != '')
            then number(normalize-space(string($obl_realizat_0077/@cass_retinut)))
            else 0"/>
        
        <let name="cass_dif_plus_0077"
            value="if ($has_cass_dif_plus_0077)
            then number(normalize-space(string($obl_realizat_0077/@cass_dif_plus)))
            else 0"/>
        
        <!-- Diferenta -->
        <let name="diff_0077"
            value="$cass_datorat_0077 - $cass_retinut_0077"/>
        
        <!-- Validare: daca atributul tinta NU exista -> nu se valideaza (true) -->
        <let name="isValid_0077"
            value="not($has_cass_dif_plus_0077)
            or
            (($diff_0077 &gt; 0 and $cass_dif_plus_0077 = $diff_0077)
            or
            ($diff_0077 &lt;= 0 and $cass_dif_plus_0077 = 0))"/>
        
        <assert test="$isValid_0077"
            flag="fatal"
            id="BR-D212-0077">
            [BR-D212-0077]
            <value-of select="
                if (normalize-space(string($desc_cass_dif_plus_0077)) != '')
                then $desc_cass_dif_plus_0077
                else 'cass_dif_plus'
                "/>
            (cass_dif_plus)
            din elementul <value-of select="name($obl_realizat_0077)"/>
            trebuie determinat astfel:
            daca
            <value-of select="
                if (normalize-space(string($desc_cass_datorat_0077)) != '')
                then $desc_cass_datorat_0077
                else 'cass_datorat'
                "/>
            minus
            <value-of select="
                if (normalize-space(string($desc_cass_retinut_0077)) != '')
                then $desc_cass_retinut_0077
                else 'cass_retinut'
                "/>
            este pozitiv,
            atunci cass_dif_plus = cass_datorat − cass_retinut;
            in caz contrar, cass_dif_plus = 0.
            (validarea se aplica doar daca cass_dif_plus exista; atribute lipsa se considera 0)
        </assert>
        
        <!-- ====================================================== -->
        <!-- BR-D212-0078: cass_dif_minus
     IF (cass_datorat − cass_retinut) < 0 THEN
     cass_dif_minus = cass_retinut − cass_datorat
     ELSE cass_dif_minus = 0
     Principiu: validarea se aplica DOAR daca atributul tinta (cass_dif_minus) exista;
                pentru calcule, atributele lipsa (cass_datorat/cass_retinut) => 0 -->
        <!-- ====================================================== -->
        
        <!-- Descrieri din XSD -->
        <let name="desc_cass_datorat_0078"
            value="$schema//xs:attribute[@name='cass_datorat']/xs:annotation/xs:documentation[1]"/>
        
        <let name="desc_cass_retinut_0078"
            value="$schema//xs:attribute[@name='cass_retinut']/xs:annotation/xs:documentation[1]"/>
        
        <let name="desc_cass_dif_minus_0078"
            value="$schema//xs:attribute[@name='cass_dif_minus']/xs:annotation/xs:documentation[1]"/>
        
        <!-- Element oblig_realizat -->
        <let name="obl_realizat_0078"
            value="(.//d212:oblig_realizat)[1]"/>
        
        <!-- existenta atributului tinta (declanseaza / nu declanseaza validarea) -->
        <let name="has_cass_dif_minus_0078"
            value="exists($obl_realizat_0078/@cass_dif_minus) and normalize-space(string($obl_realizat_0078/@cass_dif_minus)) != ''"/>
        
        <!-- Valori numerice (fallback 0 daca lipsesc/vid) -->
        <let name="cass_datorat_0078"
            value="if (exists($obl_realizat_0078/@cass_datorat) and normalize-space(string($obl_realizat_0078/@cass_datorat)) != '')
            then number(normalize-space(string($obl_realizat_0078/@cass_datorat)))
            else 0"/>
        
        <let name="cass_retinut_0078"
            value="if (exists($obl_realizat_0078/@cass_retinut) and normalize-space(string($obl_realizat_0078/@cass_retinut)) != '')
            then number(normalize-space(string($obl_realizat_0078/@cass_retinut)))
            else 0"/>
        
        <let name="cass_dif_minus_0078"
            value="if ($has_cass_dif_minus_0078)
            then number(normalize-space(string($obl_realizat_0078/@cass_dif_minus)))
            else 0"/>
        
        <!-- Diferenta -->
        <let name="diff_0078"
            value="$cass_datorat_0078 - $cass_retinut_0078"/>
        
        <!-- Validare: daca atributul tinta NU exista -> nu se valideaza (true) -->
        <let name="isValid_0078"
            value="not($has_cass_dif_minus_0078)
            or
            (($diff_0078 &lt; 0 and $cass_dif_minus_0078 = (0 - $diff_0078))
            or
            ($diff_0078 &gt;= 0 and $cass_dif_minus_0078 = 0))"/>
        
        <assert test="$isValid_0078"
            flag="fatal"
            id="BR-D212-0078">
            [BR-D212-0078]
            <value-of select="
                if (normalize-space(string($desc_cass_dif_minus_0078)) != '')
                then $desc_cass_dif_minus_0078
                else 'cass_dif_minus'
                "/>
            (cass_dif_minus)
            din elementul <value-of select="name($obl_realizat_0078)"/>
            trebuie determinat astfel:
            daca
            <value-of select="
                if (normalize-space(string($desc_cass_datorat_0078)) != '')
                then $desc_cass_datorat_0078
                else 'cass_datorat'
                "/>
            minus
            <value-of select="
                if (normalize-space(string($desc_cass_retinut_0078)) != '')
                then $desc_cass_retinut_0078
                else 'cass_retinut'
                "/>
            este negativ,
            atunci cass_dif_minus = cass_retinut − cass_datorat;
            in caz contrar, cass_dif_minus = 0.
            (validarea se aplica doar daca cass_dif_minus exista; atribute lipsa se considera 0)
        </assert>
        
        
        
        
        
        
        
        
    </rule>  
</pattern>
